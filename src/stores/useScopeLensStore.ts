import { create } from 'zustand';
import { createDemoProject } from '../data/demoSeed';
import { deduplicateWorkItems } from '../engine/scopeAnalyzer';
import { sanitizeText } from '../lib/sanitize';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { validateProject, validateWorkItem } from '../lib/validation';
import {
  createProject as apiCreateProject,
  createReportSnapshot as apiCreateReportSnapshot,
  deleteProject as apiDeleteProject,
  deleteProjectAdmin,
  getAllProjectsAdmin,
  getAllUsersAdmin,
  getCurrentSession,
  getProjectById as apiGetProjectById,
  getProjectReports as apiGetProjectReports,
  getProjects as apiGetProjects,
  getReportsCountAdmin,
  getUserProfile,
  loginUser,
  logoutUser,
  registerUser,
  saveProjectWorkspace,
  setUserRoleAdmin,
  subscribeScopeLensRealtime,
  updateProjectStatusAdmin,
  type RealtimeChangeEvent,
} from '../services';
import type {
  AdminProjectSummary,
  NegotiationStrategy,
  Project,
  ProjectReportSnapshot,
  ProjectStatus,
  RealtimeConnectionStatus,
  UserProfile,
  UserRole,
  WorkItem,
} from '../types';

const DEMO_STORAGE_KEY = 'scopelens_active_project_v3';
let authListenerAttached = false;
let manualAuthInFlight = false;
let unsubscribeRealtimeFn: (() => void) | null = null;
let realtimeUserKey: string | null = null;
let autoSyncTimer: ReturnType<typeof setTimeout> | null = null;
let realtimeRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let pendingRealtimeEvents: RealtimeChangeEvent[] = [];

function clearRealtimeSubscription(): void {
  if (realtimeRefreshTimer) {
    clearTimeout(realtimeRefreshTimer);
    realtimeRefreshTimer = null;
  }
  pendingRealtimeEvents = [];
  if (unsubscribeRealtimeFn) {
    unsubscribeRealtimeFn();
    unsubscribeRealtimeFn = null;
  }
  realtimeUserKey = null;
}

function clearAutoSyncTimer(): void {
  if (autoSyncTimer) {
    clearTimeout(autoSyncTimer);
    autoSyncTimer = null;
  }
}

function sanitizeStoredItems(items: WorkItem[], expectedType: 'original' | 'requested'): WorkItem[] {
  const valid = items
    .filter((item) => item && typeof item === 'object' && typeof item.id === 'string' && validateWorkItem(item).length === 0)
    .map((item) => ({
      ...item,
      itemType: expectedType,
      originalItemId: expectedType === 'original' ? null : item.originalItemId ?? null,
      name: sanitizeText(item.name, 160),
      description: sanitizeText(item.description ?? '', 1000),
      category: sanitizeText(item.category ?? '', 80) || 'Feature',
    }));
  return deduplicateWorkItems(valid);
}

function loadSafeLocalProject(): Project {
  const fallback = createDemoProject();
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Project>;
    if (!parsed || typeof parsed !== 'object') return fallback;
    const issues = validateProject(parsed);
    if (
      issues.length > 0 ||
      !Array.isArray(parsed.originalItems) ||
      !Array.isArray(parsed.requestedItems)
    ) {
      return fallback;
    }
    return {
      ...fallback,
      ...parsed,
      userId: null,
      isDemo: true,
      name: sanitizeText(parsed.name ?? fallback.name, 160) || fallback.name,
      clientName: sanitizeText(parsed.clientName ?? fallback.clientName, 140) || fallback.clientName,
      category: sanitizeText(parsed.category ?? fallback.category, 80) || fallback.category,
      description: sanitizeText(parsed.description ?? '', 1500),
      originalItems: sanitizeStoredItems(parsed.originalItems as WorkItem[], 'original'),
      requestedItems: sanitizeStoredItems(parsed.requestedItems as WorkItem[], 'requested'),
      swappedOutItemIds: Array.isArray(parsed.swappedOutItemIds)
        ? parsed.swappedOutItemIds.filter((id): id is string => typeof id === 'string')
        : [],
      deferredRequestIds: Array.isArray(parsed.deferredRequestIds)
        ? parsed.deferredRequestIds.filter((id): id is string => typeof id === 'string')
        : [],
      excludedRequestIds: Array.isArray(parsed.excludedRequestIds)
        ? parsed.excludedRequestIds.filter((id): id is string => typeof id === 'string')
        : [],
      holidays: Array.isArray(parsed.holidays)
        ? parsed.holidays.filter((h): h is string => typeof h === 'string')
        : [],
    };
  } catch {
    return fallback;
  }
}

function persistLocalProject(project: Project): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(project));
  } catch {
    // Abaikan quota error agar aplikasi tetap responsif
  }
}

interface ScopeLensState {
  project: Project;
  baselineLocked: boolean;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  isLoadingCloud: boolean;
  hasLoadedCloudOnce: boolean;
  cloudLoadError: string | null;
  toastMessage: { type: 'success' | 'error' | 'info'; text: string } | null;

  // Auth, Realtime & Cloud State
  user: UserProfile | null;
  cloudProjects: Project[];
  reports: ProjectReportSnapshot[];
  supabaseReady: boolean;
  realtimeStatus: RealtimeConnectionStatus;
  lastSyncedAt: string | null;

  // Admin Console State
  adminUsers: UserProfile[];
  adminProjects: AdminProjectSummary[];
  adminReportsCount: number;
  isLoadingAdmin: boolean;

  // Actions
  clearToast: () => void;
  setToast: (type: 'success' | 'error' | 'info', text: string) => void;
  toggleBaselineLock: () => void;

  updateProjectMeta: (patch: Partial<Project>) => void;
  addScopeItem: (itemType: 'original' | 'requested', item: Omit<WorkItem, 'id' | 'itemType'>) => void;
  updateScopeItemLocal: (itemType: 'original' | 'requested', id: string, patch: Partial<WorkItem>) => void;
  removeScopeItemLocal: (itemType: 'original' | 'requested', id: string) => void;

  setNegotiationStrategy: (strategy: NegotiationStrategy) => void;
  toggleSwappedOutItem: (baselineItemId: string) => void;
  toggleDeferredRequest: (requestId: string) => void;
  toggleExcludedRequest: (requestId: string) => void;

  resetDemo: () => void;
  saveWorkspace: (options?: { silent?: boolean }) => Promise<void>;
  createReportSnapshot: (title?: string) => Promise<ProjectReportSnapshot | null>;
  refreshReports: () => Promise<void>;

  // Auth & Cloud Project Actions
  initAuth: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  loadCloudProjects: () => Promise<void>;
  selectCloudProject: (
    projectId: string,
    options?: { silent?: boolean; fromRealtime?: boolean }
  ) => Promise<boolean>;
  createNewProjectWorkspace: (input: {
    name: string;
    clientName: string;
    category: string;
    initialPrice: number;
    hourlyRate: number;
    productiveHoursPerDay: number;
    startDate: string;
    initialDeadline: string;
  }) => Promise<void>;
  deleteCloudProject: (projectId: string) => Promise<void>;
  createSampleCloudProject: () => Promise<boolean>;
  switchToDemoMode: () => void;

  // Admin Actions
  loadAdminData: () => Promise<void>;
  updateUserRole: (targetUserId: string, newRole: UserRole) => Promise<void>;
  adminUpdateProjectStatus: (projectId: string, status: ProjectStatus) => Promise<void>;
  adminDeleteProject: (projectId: string) => Promise<void>;
}

export const useScopeLensStore = create<ScopeLensState>((set, get) => {
  const scheduleAutoSync = () => {
    const { user, project, supabaseReady } = get();
    if (!supabaseReady || !user || project.isDemo) return;
    clearAutoSyncTimer();
    autoSyncTimer = setTimeout(() => {
      void get().saveWorkspace({ silent: true });
    }, 700);
  };

  const ensureRealtimeSubscription = (profile: UserProfile) => {
    if (!isSupabaseConfigured) {
      set({ realtimeStatus: 'unconfigured' });
      return;
    }

    const nextKey = `${profile.id}:${profile.role}`;
    if (realtimeUserKey === nextKey && unsubscribeRealtimeFn) {
      return;
    }

    clearRealtimeSubscription();
    realtimeUserKey = nextKey;

    unsubscribeRealtimeFn = subscribeScopeLensRealtime({
      userId: profile.id,
      role: profile.role,
      onStatusChange: (status) => {
        set({ realtimeStatus: status });
      },
      onDatabaseChange: (event) => {
        pendingRealtimeEvents.push(event);
        if (realtimeRefreshTimer) clearTimeout(realtimeRefreshTimer);
        realtimeRefreshTimer = setTimeout(() => {
          const events = [...pendingRealtimeEvents];
          pendingRealtimeEvents = [];
          void handleRealtimeBatch(events);
        }, 280);
      },
    });
  };

  const handleRealtimeBatch = async (events: RealtimeChangeEvent[]) => {
    const state = get();
    if (!state.user || !isSupabaseConfigured) return;

    const touchedTables = new Set(events.map((e) => e.table));
    const currentUserId = state.user.id;

    // 1. Jika profil user aktif berubah (misal role diubah oleh Admin), segarkan profil & channel
    if (touchedTables.has('profiles')) {
      const latestProfile = await getUserProfile(currentUserId);
      if (latestProfile) {
        const roleChanged = latestProfile.role !== state.user.role;
        set({ user: latestProfile });
        if (roleChanged) {
          ensureRealtimeSubscription(latestProfile);
          set({
            toastMessage: {
              type: 'info',
              text:
                latestProfile.role === 'admin'
                  ? 'Peran akun Anda diperbarui menjadi Admin.'
                  : 'Peran akun Anda diperbarui menjadi User.',
            },
          });
        }
      }
    }

    // 2. Segarkan daftar proyek pribadi
    if (touchedTables.has('projects') || touchedTables.has('scope_items')) {
      await get().loadCloudProjects();
    }

    // 3. Jika admin, segarkan data konsol admin secara real-time
    if (get().user?.role === 'admin') {
      await get().loadAdminData();
    }

    // 4. Segarkan proyek aktif jika tidak sedang menyimpan/punya draft lokal
    const latestState = get();
    const activeProj = latestState.project;
    if (!activeProj.isDemo) {
      const deletedActive = events.some(
        (e) => e.table === 'projects' && e.eventType === 'DELETE' && e.recordId === activeProj.id
      );

      if (deletedActive) {
        const remaining = latestState.cloudProjects.filter((p) => p.id !== activeProj.id);
        if (remaining.length > 0) {
          await get().selectCloudProject(remaining[0].id, { silent: true });
        } else {
          clearAutoSyncTimer();
          set({
            project: createDemoProject(),
            baselineLocked: true,
            hasUnsavedChanges: false,
            reports: [],
          });
        }
        set({
          toastMessage: {
            type: 'info',
            text: 'Proyek yang sedang dibuka telah dihapus.',
          },
        });
        return;
      }

      const activeTouched = events.some(
        (e) =>
          e.projectId === activeProj.id ||
          (e.table === 'projects' && e.recordId === activeProj.id)
      );

      if (activeTouched && !latestState.isSaving && !latestState.hasUnsavedChanges) {
        await get().selectCloudProject(activeProj.id, { silent: true, fromRealtime: true });
      } else if (touchedTables.has('project_reports')) {
        await get().refreshReports();
      }

      if (activeTouched && touchedTables.has('project_reports') && latestState.hasUnsavedChanges) {
        await get().refreshReports();
      }
    }
  };

  return {
    project: loadSafeLocalProject(),
    baselineLocked: true,
    hasUnsavedChanges: false,
    isSaving: false,
    isLoadingCloud: false,
    hasLoadedCloudOnce: false,
    cloudLoadError: null,
    toastMessage: null,

    user: null,
    cloudProjects: [],
    reports: [],
    supabaseReady: isSupabaseConfigured,
    realtimeStatus: isSupabaseConfigured ? 'offline' : 'unconfigured',
    lastSyncedAt: null,

    adminUsers: [],
    adminProjects: [],
    adminReportsCount: 0,
    isLoadingAdmin: false,

    clearToast: () => set({ toastMessage: null }),
    setToast: (type, text) => set({ toastMessage: { type, text } }),
    toggleBaselineLock: () => set((s) => ({ baselineLocked: !s.baselineLocked })),

    updateProjectMeta: (patch) => {
      set((state) => {
        const next: Project = {
          ...state.project,
          ...patch,
          name: patch.name !== undefined ? sanitizeText(patch.name, 160) : state.project.name,
          clientName:
            patch.clientName !== undefined
              ? sanitizeText(patch.clientName, 140)
              : state.project.clientName,
          category:
            patch.category !== undefined
              ? sanitizeText(patch.category, 80)
              : state.project.category,
          description:
            patch.description !== undefined
              ? sanitizeText(patch.description, 1500)
              : state.project.description,
        };
        if (next.isDemo || !state.user) {
          persistLocalProject(next);
        }
        return { project: next, hasUnsavedChanges: true };
      });
      scheduleAutoSync();
    },

    addScopeItem: (itemType, item) => {
      const issues = validateWorkItem({ ...item, itemType });
      if (issues.length > 0) {
        set({ toastMessage: { type: 'error', text: issues[0].message } });
        return;
      }

      const id =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const cleanItem: WorkItem = {
        ...item,
        id,
        itemType,
        originalItemId: itemType === 'original' ? null : item.originalItemId ?? null,
        name: sanitizeText(item.name, 160),
        description: sanitizeText(item.description, 1000),
        category: sanitizeText(item.category, 80) || 'Feature',
        status:
          itemType === 'original'
            ? 'unchanged'
            : item.originalItemId
              ? item.status === 'removed'
                ? 'removed'
                : 'modified'
              : 'added',
      };

      set((state) => {
        const next: Project = {
          ...state.project,
          originalItems:
            itemType === 'original'
              ? [...state.project.originalItems, cleanItem]
              : state.project.originalItems,
          requestedItems:
            itemType === 'requested'
              ? [...state.project.requestedItems, cleanItem]
              : state.project.requestedItems,
        };
        if (next.isDemo || !state.user) {
          persistLocalProject(next);
        }
        return { project: next, hasUnsavedChanges: true };
      });
      scheduleAutoSync();
    },

    updateScopeItemLocal: (itemType, id, patch) => {
      set((state) => {
        const updateList = (list: WorkItem[]) =>
          list.map((item) => {
            if (item.id !== id) return item;
            const updated: WorkItem = {
              ...item,
              ...patch,
              name: patch.name !== undefined ? sanitizeText(patch.name, 160) : item.name,
              description:
                patch.description !== undefined
                  ? sanitizeText(patch.description, 1000)
                  : item.description,
              category:
                patch.category !== undefined
                  ? sanitizeText(patch.category, 80)
                  : item.category,
            };
            if (itemType === 'requested') {
              if (updated.originalItemId === null) {
                updated.status = updated.status === 'deferred' ? 'deferred' : 'added';
              } else if (updated.status !== 'removed' && updated.status !== 'deferred') {
                updated.status = 'modified';
              }
            }
            return updated;
          });

        const next: Project = {
          ...state.project,
          originalItems:
            itemType === 'original'
              ? updateList(state.project.originalItems)
              : state.project.originalItems,
          requestedItems:
            itemType === 'requested'
              ? updateList(state.project.requestedItems)
              : state.project.requestedItems,
        };
        if (next.isDemo || !state.user) {
          persistLocalProject(next);
        }
        return { project: next, hasUnsavedChanges: true };
      });
      scheduleAutoSync();
    },

    removeScopeItemLocal: (itemType, id) => {
      set((state) => {
        const next: Project = {
          ...state.project,
          originalItems:
            itemType === 'original'
              ? state.project.originalItems.filter((i) => i.id !== id)
              : state.project.originalItems,
          requestedItems:
            itemType === 'requested'
              ? state.project.requestedItems.filter((i) => i.id !== id)
              : state.project.requestedItems,
          swappedOutItemIds: state.project.swappedOutItemIds.filter((sid) => sid !== id),
          deferredRequestIds: state.project.deferredRequestIds.filter((did) => did !== id),
          excludedRequestIds: state.project.excludedRequestIds.filter((eid) => eid !== id),
        };
        if (next.isDemo || !state.user) {
          persistLocalProject(next);
        }
        return { project: next, hasUnsavedChanges: true };
      });
      scheduleAutoSync();
    },

    setNegotiationStrategy: (strategy) => {
      set((state) => {
        const next: Project = {
          ...state.project,
          negotiationStrategy: strategy,
        };
        if (next.isDemo || !state.user) {
          persistLocalProject(next);
        }
        return { project: next, hasUnsavedChanges: true };
      });
      scheduleAutoSync();
    },

    toggleSwappedOutItem: (baselineItemId) => {
      set((state) => {
        const exists = state.project.swappedOutItemIds.includes(baselineItemId);
        const nextIds = exists
          ? state.project.swappedOutItemIds.filter((id) => id !== baselineItemId)
          : [...state.project.swappedOutItemIds, baselineItemId];
        const next: Project = {
          ...state.project,
          swappedOutItemIds: nextIds,
        };
        if (next.isDemo || !state.user) {
          persistLocalProject(next);
        }
        return { project: next, hasUnsavedChanges: true };
      });
      scheduleAutoSync();
    },

    toggleDeferredRequest: (requestId) => {
      set((state) => {
        const exists = state.project.deferredRequestIds.includes(requestId);
        const nextIds = exists
          ? state.project.deferredRequestIds.filter((id) => id !== requestId)
          : [...state.project.deferredRequestIds, requestId];
        const next: Project = {
          ...state.project,
          deferredRequestIds: nextIds,
          requestedItems: state.project.requestedItems.map((r) =>
            r.id === requestId
              ? {
                  ...r,
                  status: exists ? (r.originalItemId ? 'modified' : 'added') : 'deferred',
                }
              : r
          ),
        };
        if (next.isDemo || !state.user) {
          persistLocalProject(next);
        }
        return { project: next, hasUnsavedChanges: true };
      });
      scheduleAutoSync();
    },

    toggleExcludedRequest: (requestId) => {
      set((state) => {
        const exists = state.project.excludedRequestIds.includes(requestId);
        const nextIds = exists
          ? state.project.excludedRequestIds.filter((id) => id !== requestId)
          : [...state.project.excludedRequestIds, requestId];
        const next: Project = {
          ...state.project,
          excludedRequestIds: nextIds,
        };
        if (next.isDemo || !state.user) {
          persistLocalProject(next);
        }
        return { project: next, hasUnsavedChanges: true };
      });
      scheduleAutoSync();
    },

    resetDemo: () => {
      clearAutoSyncTimer();
      const fresh = createDemoProject();
      persistLocalProject(fresh);
      set({
        project: fresh,
        baselineLocked: true,
        hasUnsavedChanges: false,
        reports: [],
        toastMessage: {
          type: 'info',
          text: 'Contoh kasus "Website Company Profile" berhasil dimuat ulang.',
        },
      });
      void get().refreshReports();
    },

    saveWorkspace: async (options) => {
      clearAutoSyncTimer();
      const silent = Boolean(options?.silent);
      const { project, user } = get();
      if (!user || !isSupabaseConfigured || (silent && project.isDemo)) {
        persistLocalProject(project);
        set({
          hasUnsavedChanges: false,
          toastMessage: silent
            ? get().toastMessage
            : {
                type: 'success',
                text: 'Perubahan tersimpan aman di penyimpanan lokal browser.',
              },
        });
        return;
      }

      set({ isSaving: true });
      try {
        const saved = await saveProjectWorkspace(project);
        const editedDuringSave = get().project !== project;
        set((s) => ({
          project: editedDuringSave
            ? { ...s.project, id: saved.id, isDemo: false }
            : { ...saved, isDemo: false },
          hasUnsavedChanges: editedDuringSave ? s.hasUnsavedChanges : false,
          isSaving: false,
          lastSyncedAt: new Date().toISOString(),
          toastMessage: silent
            ? s.toastMessage
            : {
                type: 'success',
                text: 'Perubahan proyek berhasil disimpan ke Supabase.',
              },
        }));
        await get().loadCloudProjects();
        if (get().user?.role === 'admin') {
          await get().loadAdminData();
        }
      } catch (err) {
        set({
          isSaving: false,
          toastMessage: {
            type: 'error',
            text: err instanceof Error ? err.message : 'Gagal menyimpan proyek.',
          },
        });
      }
    },

    createReportSnapshot: async (title) => {
      const { project, user } = get();
      try {
        const snapshot = await apiCreateReportSnapshot(project, {
          title,
          isAuthenticated: Boolean(user && !project.isDemo),
        });
        set((s) => ({
          reports: [snapshot, ...s.reports],
          toastMessage: {
            type: 'success',
            text: 'Snapshot laporan perubahan berhasil diarsipkan.',
          },
        }));
        return snapshot;
      } catch (err) {
        set({
          toastMessage: {
            type: 'error',
            text: err instanceof Error ? err.message : 'Gagal membuat snapshot laporan.',
          },
        });
        return null;
      }
    },

    refreshReports: async () => {
      const { project, user } = get();
      try {
        const rows = await apiGetProjectReports(project.id, {
          isAuthenticated: Boolean(user && !project.isDemo),
        });
        set({ reports: rows });
      } catch {
        // Abaikan diam-diam saat offline
      }
    },

    initAuth: async () => {
      const supabase = getSupabaseClient();
      if (!isSupabaseConfigured || !supabase) {
        if (!get().user) {
          set({ realtimeStatus: 'unconfigured' });
        }
        return;
      }

      if (!authListenerAttached) {
        authListenerAttached = true;
        supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_OUT' || !session?.user) {
            if (manualAuthInFlight) return;
            clearAutoSyncTimer();
            clearRealtimeSubscription();
            const safeDemo = loadSafeLocalProject();
            set({
              user: null,
              cloudProjects: [],
              reports: [],
              adminUsers: [],
              adminProjects: [],
              adminReportsCount: 0,
              project: get().project.isDemo ? get().project : safeDemo,
              hasUnsavedChanges: false,
              isLoadingCloud: false,
              hasLoadedCloudOnce: false,
              cloudLoadError: null,
              lastSyncedAt: null,
              realtimeStatus: 'offline',
            });
            return;
          }
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
            if (event === 'SIGNED_IN' && manualAuthInFlight) {
              return;
            }
            void getUserProfile(session.user.id).then((profile) => {
              if (event === 'SIGNED_IN' && manualAuthInFlight) {
                return;
              }
              const resolved: UserProfile = profile ?? {
                id: session.user.id,
                email: session.user.email ?? '',
                fullName: String(session.user.user_metadata?.full_name ?? ''),
                role: 'user',
              };
              const alreadyLoadedSameUser =
                event === 'SIGNED_IN' &&
                get().user?.id === resolved.id &&
                (get().hasLoadedCloudOnce || get().isLoadingCloud);

              set({
                user: resolved,
                ...(event === 'SIGNED_IN' && !alreadyLoadedSameUser
                  ? {
                      isLoadingCloud: true,
                      hasLoadedCloudOnce: false,
                      cloudLoadError: null,
                      hasUnsavedChanges: false,
                    }
                  : {}),
              });
              ensureRealtimeSubscription(resolved);
              if (event === 'SIGNED_IN' && !alreadyLoadedSameUser) {
                void get().loadCloudProjects();
              }
              if (resolved.role === 'admin' && !alreadyLoadedSameUser) {
                void get().loadAdminData();
              }
            });
          }
        });
      }

      const session = await getCurrentSession();
      if (!session?.user) {
        set({
          realtimeStatus: 'offline',
          isLoadingCloud: false,
          hasLoadedCloudOnce: false,
          cloudLoadError: null,
        });
        return;
      }

      const profile = await getUserProfile(session.user.id);
      const resolved: UserProfile = profile ?? {
        id: session.user.id,
        email: session.user.email ?? '',
        fullName: String(session.user.user_metadata?.full_name ?? ''),
        role: 'user',
      };
      set({
        user: resolved,
        isLoadingCloud: true,
        hasLoadedCloudOnce: false,
        cloudLoadError: null,
      });
      ensureRealtimeSubscription(resolved);
      await get().loadCloudProjects();
      if (resolved.role === 'admin') {
        await get().loadAdminData();
      }
    },

    signIn: async (email, password) => {
      manualAuthInFlight = true;
      try {
        const profile = await loginUser(email, password);
        set({
          user: profile,
          project: createDemoProject(),
          reports: [],
          hasUnsavedChanges: false,
          isLoadingCloud: true,
          hasLoadedCloudOnce: false,
          cloudLoadError: null,
          toastMessage: {
            type: 'success',
            text: `Selamat datang kembali, ${profile.fullName || profile.email}.`,
          },
        });
        ensureRealtimeSubscription(profile);
        await get().loadCloudProjects();
        if (profile.role === 'admin') {
          await get().loadAdminData();
        }
      } finally {
        manualAuthInFlight = false;
      }
    },

    signUp: async (email, password, fullName) => {
      manualAuthInFlight = true;
      try {
        const res = await registerUser(email, password, fullName);
        if (!res.needsEmailConfirmation && res.user) {
          set({
            user: res.user,
            project: createDemoProject(),
            reports: [],
            hasUnsavedChanges: false,
            isLoadingCloud: true,
            hasLoadedCloudOnce: false,
            cloudLoadError: null,
            toastMessage: { type: 'success', text: 'Akun berhasil dibuat dan langsung aktif.' },
          });
          ensureRealtimeSubscription(res.user);
          await get().loadCloudProjects();
          if (res.user.role === 'admin') {
            await get().loadAdminData();
          }
        } else {
          set({
            toastMessage: {
              type: 'info',
              text: 'Pendaftaran berhasil. Periksa email Anda untuk konfirmasi akun.',
            },
          });
        }
        return { needsEmailConfirmation: res.needsEmailConfirmation };
      } finally {
        manualAuthInFlight = false;
      }
    },

    signOut: async () => {
      manualAuthInFlight = true;
      try {
        await logoutUser();
      } finally {
        manualAuthInFlight = false;
        clearAutoSyncTimer();
        clearRealtimeSubscription();
        const freshDemo = loadSafeLocalProject();
        set({
          user: null,
          cloudProjects: [],
          reports: [],
          adminUsers: [],
          adminProjects: [],
          adminReportsCount: 0,
          project: freshDemo,
          hasUnsavedChanges: false,
          isLoadingCloud: false,
          hasLoadedCloudOnce: false,
          cloudLoadError: null,
          realtimeStatus: isSupabaseConfigured ? 'offline' : 'unconfigured',
          lastSyncedAt: null,
          toastMessage: { type: 'info', text: 'Anda telah keluar dari akun.' },
        });
        if (!isSupabaseConfigured) {
          void get().refreshReports();
        }
      }
    },

    loadCloudProjects: async () => {
      const { user } = get();
      if (!user || !isSupabaseConfigured) return;
      set({ isLoadingCloud: true, cloudLoadError: null });
      try {
        const { projects } = await apiGetProjects({ page: 1, pageSize: 20, userId: user.id });
        set({
          cloudProjects: projects,
          isLoadingCloud: false,
          hasLoadedCloudOnce: true,
          cloudLoadError: null,
          lastSyncedAt: new Date().toISOString(),
        });
        // Jika belum ada proyek cloud aktif di workspace dan akun punya proyek asli, langsung muat proyek terbaru
        if (get().project.isDemo && projects.length > 0 && !get().hasUnsavedChanges) {
          await get().selectCloudProject(projects[0].id, { silent: true });
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Gagal memuat daftar proyek dari database.';
        set({
          isLoadingCloud: false,
          hasLoadedCloudOnce: true,
          cloudLoadError: message,
          toastMessage: { type: 'error', text: message },
        });
      }
    },

    selectCloudProject: async (projectId, options) => {
      const fromRealtime = Boolean(options?.fromRealtime);
      if (!fromRealtime) {
        clearAutoSyncTimer();
      } else if (get().hasUnsavedChanges || get().isSaving) {
        return false;
      }

      set({ isLoadingCloud: true });
      try {
        const proj = await apiGetProjectById(projectId);
        if (fromRealtime) {
          const latest = get();
          if (latest.project.id !== projectId || latest.hasUnsavedChanges || latest.isSaving) {
            set({ isLoadingCloud: false });
            return false;
          }
        }
        set({
          project: { ...proj, isDemo: false },
          hasUnsavedChanges: false,
          isLoadingCloud: false,
          cloudLoadError: null,
          lastSyncedAt: new Date().toISOString(),
          toastMessage: options?.silent
            ? get().toastMessage
            : { type: 'success', text: `Memuat proyek "${proj.name}".` },
        });
        await get().refreshReports();
        return true;
      } catch (err) {
        set({
          isLoadingCloud: false,
          toastMessage: {
            type: 'error',
            text: err instanceof Error ? err.message : 'Gagal memuat proyek.',
          },
        });
        return false;
      }
    },

    createNewProjectWorkspace: async (input) => {
      clearAutoSyncTimer();
      const { user } = get();
      const baseProject: Project = {
        id:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `proj-${Date.now()}`,
        userId: user?.id ?? null,
        name: sanitizeText(input.name, 160),
        clientName: sanitizeText(input.clientName, 140),
        category: sanitizeText(input.category, 80) || 'Web Development',
        description: '',
        startDate: input.startDate,
        initialDeadline: input.initialDeadline,
        initialPrice: Math.round(input.initialPrice),
        hourlyRate: Math.round(input.hourlyRate),
        productiveHoursPerDay: input.productiveHoursPerDay,
        workingDays: [1, 2, 3, 4, 5],
        holidays: [],
        currency: 'IDR',
        status: 'active',
        originalItems: [],
        requestedItems: [],
        negotiationStrategy: 'accept_changes',
        swappedOutItemIds: [],
        deferredRequestIds: [],
        excludedRequestIds: [],
        isDemo: !user || !isSupabaseConfigured,
      };

      if (user && isSupabaseConfigured) {
        const created = await apiCreateProject(baseProject);
        set({
          project: { ...created, isDemo: false },
          baselineLocked: false,
          hasUnsavedChanges: false,
          isLoadingCloud: false,
          hasLoadedCloudOnce: true,
          cloudLoadError: null,
          reports: [],
          lastSyncedAt: new Date().toISOString(),
          toastMessage: { type: 'success', text: `Proyek "${created.name}" berhasil disimpan ke database.` },
        });
        await get().loadCloudProjects();
        if (user.role === 'admin') {
          await get().loadAdminData();
        }
        return;
      }

      persistLocalProject(baseProject);
      set({
        project: baseProject,
        baselineLocked: false,
        hasUnsavedChanges: false,
        reports: [],
        toastMessage: { type: 'success', text: `Proyek "${baseProject.name}" siap diisi.` },
      });
    },

    deleteCloudProject: async (projectId) => {
      try {
        await apiDeleteProject(projectId);
        const { project, user } = get();
        const wasActive = project.id === projectId;
        if (wasActive) {
          clearAutoSyncTimer();
          set({
            project: createDemoProject(),
            baselineLocked: true,
            hasUnsavedChanges: false,
            reports: [],
          });
        }
        await get().loadCloudProjects();
        if (user?.role === 'admin') {
          await get().loadAdminData();
        }
        set({ toastMessage: { type: 'info', text: 'Proyek berhasil dihapus.' } });
      } catch (err) {
        set({
          toastMessage: {
            type: 'error',
            text: err instanceof Error ? err.message : 'Gagal menghapus proyek.',
          },
        });
      }
    },

    createSampleCloudProject: async () => {
      const { user } = get();
      if (!user || !isSupabaseConfigured) {
        get().switchToDemoMode();
        return true;
      }
      clearAutoSyncTimer();
      set({ isSaving: true });
      try {
        const template = createDemoProject();
        const saved = await saveProjectWorkspace({
          ...template,
          id: 'template-copy',
          userId: user.id,
          isDemo: false,
        });
        set({
          project: { ...saved, isDemo: false },
          baselineLocked: true,
          hasUnsavedChanges: false,
          isSaving: false,
          isLoadingCloud: false,
          hasLoadedCloudOnce: true,
          cloudLoadError: null,
          reports: [],
          lastSyncedAt: new Date().toISOString(),
          toastMessage: {
            type: 'success',
            text: `Proyek contoh "${saved.name}" berhasil disimpan ke akun Anda.`,
          },
        });
        await get().loadCloudProjects();
        await get().refreshReports();
        if (user.role === 'admin') {
          await get().loadAdminData();
        }
        return true;
      } catch (err) {
        set({
          isSaving: false,
          toastMessage: {
            type: 'error',
            text: err instanceof Error ? err.message : 'Gagal menyalin contoh proyek ke akun.',
          },
        });
        return false;
      }
    },

    switchToDemoMode: () => {
      clearAutoSyncTimer();
      const demo = createDemoProject();
      persistLocalProject(demo);
      set({
        project: demo,
        baselineLocked: true,
        hasUnsavedChanges: false,
        reports: [],
        toastMessage: { type: 'info', text: 'Membuka contoh kasus proyek lokal.' },
      });
      void get().refreshReports();
    },

    loadAdminData: async () => {
      const { user } = get();
      if (!user || user.role !== 'admin' || !isSupabaseConfigured) return;

      set({ isLoadingAdmin: true });
      try {
        const [users, projects, reportsCount] = await Promise.all([
          getAllUsersAdmin(),
          getAllProjectsAdmin(),
          getReportsCountAdmin(),
        ]);
        set({
          adminUsers: users,
          adminProjects: projects,
          adminReportsCount: reportsCount,
          isLoadingAdmin: false,
          lastSyncedAt: new Date().toISOString(),
        });
      } catch (err) {
        set({
          isLoadingAdmin: false,
          toastMessage: {
            type: 'error',
            text: err instanceof Error ? err.message : 'Gagal memuat data admin.',
          },
        });
      }
    },

    updateUserRole: async (targetUserId, newRole) => {
      const { user } = get();
      if (!user || user.role !== 'admin') {
        set({ toastMessage: { type: 'error', text: 'Hanya admin yang dapat mengubah peran pengguna.' } });
        return;
      }
      const updated = await setUserRoleAdmin(targetUserId, newRole);
      const isSelfDemoted = updated.id === user.id && updated.role !== 'admin';
      set((s) => ({
        adminUsers: isSelfDemoted
          ? []
          : s.adminUsers.map((u) => (u.id === updated.id ? updated : u)),
        adminProjects: isSelfDemoted ? [] : s.adminProjects,
        adminReportsCount: isSelfDemoted ? 0 : s.adminReportsCount,
        user: s.user?.id === updated.id ? updated : s.user,
        toastMessage: {
          type: 'success',
          text: `Peran ${updated.fullName || updated.email} diubah menjadi ${
            updated.role === 'admin' ? 'Admin' : 'User'
          }.`,
        },
      }));
      if (updated.id === user.id) {
        ensureRealtimeSubscription(updated);
      }
    },

    adminUpdateProjectStatus: async (projectId, status) => {
      const { user } = get();
      if (!user || user.role !== 'admin') return;
      await updateProjectStatusAdmin(projectId, status);
      set((s) => ({
        adminProjects: s.adminProjects.map((p) => (p.id === projectId ? { ...p, status } : p)),
        project: s.project.id === projectId ? { ...s.project, status } : s.project,
        toastMessage: { type: 'success', text: 'Status proyek diperbarui.' },
      }));
    },

    adminDeleteProject: async (projectId) => {
      const { user } = get();
      if (!user || user.role !== 'admin') return;
      await deleteProjectAdmin(projectId);
      const wasActive = get().project.id === projectId;
      set((s) => ({
        adminProjects: s.adminProjects.filter((p) => p.id !== projectId),
        cloudProjects: s.cloudProjects.filter((p) => p.id !== projectId),
        ...(wasActive
          ? {
              project: createDemoProject(),
              baselineLocked: true,
              hasUnsavedChanges: false,
              reports: [],
            }
          : {}),
        toastMessage: { type: 'info', text: 'Proyek berhasil dihapus oleh Admin.' },
      }));
      if (wasActive) {
        const remaining = get().cloudProjects;
        if (remaining.length > 0) {
          await get().selectCloudProject(remaining[0].id, { silent: true });
        }
      }
    },
  };
});
