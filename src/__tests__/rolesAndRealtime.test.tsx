import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { createDemoProject } from '../data/demoSeed';
import * as supabaseLib from '../lib/supabase';
import { normalizeUserRole, toSafeErrorMessage } from '../services/authService';
import { subscribeScopeLensRealtime } from '../services/realtimeService';
import { useScopeLensStore } from '../stores/useScopeLensStore';
import type { AdminProjectSummary, ProjectReportSnapshot, UserProfile } from '../types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Role-Based Access Control (Admin & User) & Security Guards', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    useScopeLensStore.setState({
      user: null,
      cloudProjects: [],
      adminUsers: [],
      adminProjects: [],
      adminReportsCount: 0,
      realtimeStatus: 'unconfigured',
    });
    useScopeLensStore.getState().resetDemo();
    useScopeLensStore.getState().clearToast();

    if (!globalThis.ResizeObserver) {
      globalThis.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }
    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
        this.setAttribute('open', '');
      };
    }
    if (!HTMLDialogElement.prototype.close) {
      HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
        this.removeAttribute('open');
        this.dispatchEvent(new Event('close'));
      };
    }

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('menormalisasi role dengan ketat: hanya "admin" yang menjadi admin, nilai lain selalu menjadi "user"', () => {
    expect(normalizeUserRole('admin')).toBe('admin');
    expect(normalizeUserRole('user')).toBe('user');
    expect(normalizeUserRole('superadmin')).toBe('user');
    expect(normalizeUserRole('')).toBe('user');
    expect(normalizeUserRole(null)).toBe('user');
    expect(normalizeUserRole(undefined)).toBe('user');
  });

  it('menerjemahkan error privilege escalation & demote admin terakhir menjadi pesan aman tanpa bocor SQL', () => {
    expect(toSafeErrorMessage({ message: 'Forbidden: hanya admin yang dapat mengubah role pengguna.' })).toContain(
      'tidak memiliki izin'
    );
    expect(toSafeErrorMessage({ message: 'Cannot demote the last remaining administrator.' })).toContain(
      'admin terakhir'
    );
    expect(toSafeErrorMessage({ message: 'new row violates check constraint' }, 'Gagal')).toBe('Gagal');
  });

  it('menyembunyikan tombol Panel Kontrol Admin bagi pengguna biasa (role: user)', async () => {
    const sampleProj = {
      ...createDemoProject(),
      id: '22222222-2222-4222-8222-222222222222',
      userId: 'user-1',
      isDemo: false,
    };
    const origInitAuth = useScopeLensStore.getState().initAuth;
    useScopeLensStore.setState({
      user: {
        id: 'user-1',
        email: 'freelancer@example.com',
        fullName: 'Budi Santoso',
        role: 'user',
      },
      project: sampleProj,
      cloudProjects: [sampleProj],
      hasLoadedCloudOnce: true,
      supabaseReady: true,
      realtimeStatus: 'connected',
      initAuth: async () => {},
    });

    try {
      await act(async () => {
        root.render(<App />);
      });

      const adminNav = container.querySelector('button[aria-label="Panel Kontrol Admin"]');
      expect(adminNav).toBeNull();
      expect(container.textContent).toContain('User');
      expect(container.textContent).toContain('Live');
      expect(container.textContent).toContain('Halo, Budi');
    } finally {
      useScopeLensStore.setState({ initAuth: origInitAuth });
    }
  });

  it('menolak aksi updateUserRole di store bila user aktif bukan admin', async () => {
    useScopeLensStore.setState({
      user: {
        id: 'user-1',
        email: 'freelancer@example.com',
        fullName: 'Budi Santoso',
        role: 'user',
      },
    });

    await useScopeLensStore.getState().updateUserRole('user-1', 'admin');
    const state = useScopeLensStore.getState();
    expect(state.user?.role).toBe('user');
    expect(state.toastMessage?.type).toBe('error');
    expect(state.toastMessage?.text).toContain('Hanya admin');
  });

  it('menampilkan Panel Kontrol Admin bagi role admin beserta daftar user & proyek real-time', async () => {
    const adminProfile: UserProfile = {
      id: 'admin-1',
      email: 'admin@scopelens.id',
      fullName: 'Rina Admin',
      role: 'admin',
      createdAt: '2026-11-10T00:00:00Z',
    };
    const regularUser: UserProfile = {
      id: 'user-2',
      email: 'user@scopelens.id',
      fullName: 'Dika Freelancer',
      role: 'user',
      createdAt: '2026-11-12T00:00:00Z',
    };

    const sampleProj = createDemoProject();
    const adminProj: AdminProjectSummary = {
      ...sampleProj,
      id: '11111111-1111-4111-8111-111111111111',
      userId: regularUser.id,
      ownerName: regularUser.fullName,
      ownerEmail: regularUser.email,
      scopeItemsCount: sampleProj.originalItems.length + sampleProj.requestedItems.length,
      isDemo: false,
    };

    const origInitAuth = useScopeLensStore.getState().initAuth;
    useScopeLensStore.setState({
      user: adminProfile,
      project: { ...sampleProj, id: adminProj.id, isDemo: false },
      hasLoadedCloudOnce: true,
      supabaseReady: true,
      realtimeStatus: 'connected',
      lastSyncedAt: '2026-11-16T10:00:00Z',
      adminUsers: [adminProfile, regularUser],
      adminProjects: [adminProj],
      adminReportsCount: 3,
      initAuth: async () => {},
    });

    try {
      await act(async () => {
        root.render(<App />);
      });

      const adminNav = container.querySelector('button[aria-label="Panel Kontrol Admin"]');
      expect(adminNav).toBeTruthy();

      await act(async () => {
        adminNav!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      const text = container.textContent ?? '';
      expect(text).toContain('Manajemen Pengguna & Proyek Real-Time');
      expect(text).toContain('Live Real-Time');
      expect(text).toContain('Rina Admin');
      expect(text).toContain('Dika Freelancer');
      expect(text).toContain('Jadikan Admin');
      expect(text).toContain('Admin Terakhir');
      expect(text).toContain('Website Company Profile');

      // Tombol Admin Terakhir pada satu-satunya admin harus disabled
      const lastAdminBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Admin Terakhir')
      ) as HTMLButtonElement | undefined;
      expect(lastAdminBtn).toBeTruthy();
      expect(lastAdminBtn!.disabled).toBe(true);
    } finally {
      useScopeLensStore.setState({ initAuth: origInitAuth });
    }
  });

  it('subscribeScopeLensRealtime melaporkan status "unconfigured" dengan aman saat .env.local belum diisi', () => {
    vi.spyOn(supabaseLib, 'getSupabaseClient').mockReturnValue(null);
    const statuses: string[] = [];
    const unsubscribe = subscribeScopeLensRealtime({
      userId: 'user-1',
      role: 'user',
      onStatusChange: (s) => statuses.push(s),
      onDatabaseChange: () => {},
    });
    expect(statuses).toEqual(['unconfigured']);
    expect(() => unsubscribe()).not.toThrow();
  });

  it('mengabaikan callback CLOSED dan event database lama setelah channel realtime di-unsubscribe (anti stale status)', () => {
    let subscribeCb: ((status: string) => void) | null = null;
    const payloadCbs: Array<(payload: unknown) => void> = [];

    const fakeChannel = {
      on: vi.fn((_type: string, _filter: unknown, cb: (payload: unknown) => void) => {
        payloadCbs.push(cb);
        return fakeChannel;
      }),
      subscribe: vi.fn((cb: (status: string) => void) => {
        subscribeCb = cb;
        cb('SUBSCRIBED');
        return fakeChannel;
      }),
    };

    const fakeClient = {
      channel: vi.fn(() => fakeChannel),
      removeChannel: vi.fn(async () => 'ok'),
    };

    vi.spyOn(supabaseLib, 'getSupabaseClient').mockReturnValue(
      fakeClient as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>
    );

    const statuses: string[] = [];
    const events: unknown[] = [];
    const unsubscribe = subscribeScopeLensRealtime({
      userId: 'user-1',
      role: 'user',
      onStatusChange: (s) => statuses.push(s),
      onDatabaseChange: (ev) => events.push(ev),
    });

    expect(statuses).toEqual(['connecting', 'connected']);

    // Unsubscribe memicu offline satu kali, lalu callback CLOSED asinkron yang terlambat harus diabaikan
    unsubscribe();
    expect(statuses).toEqual(['connecting', 'connected', 'offline']);

    subscribeCb!('CLOSED');
    subscribeCb!('CHANNEL_ERROR');
    payloadCbs[0]?.({ eventType: 'UPDATE', new: { id: 'proj-1' }, old: {} });

    expect(statuses).toEqual(['connecting', 'connected', 'offline']);
    expect(events).toHaveLength(0);
  });

  it('signOut membersihkan seluruh state privat termasuk reports, admin data, dan proyek cloud', async () => {
    const sampleProj = createDemoProject();
    const fakeReport: ProjectReportSnapshot = {
      id: 'rep-cloud-1',
      projectId: '11111111-1111-4111-8111-111111111111',
      negotiationId: null,
      reportTitle: 'Laporan Rahasia Klien',
      generatedAt: '2026-11-16T10:00:00Z',
      reportData: {} as ProjectReportSnapshot['reportData'],
    };

    useScopeLensStore.setState({
      user: {
        id: 'admin-1',
        email: 'admin@scopelens.id',
        fullName: 'Rina Admin',
        role: 'admin',
      },
      project: {
        ...sampleProj,
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Proyek Cloud Rahasia',
        isDemo: false,
      },
      reports: [fakeReport],
      adminUsers: [
        { id: 'admin-1', email: 'admin@scopelens.id', fullName: 'Rina Admin', role: 'admin' },
      ],
      adminReportsCount: 5,
      lastSyncedAt: '2026-11-16T10:00:00Z',
    });

    await useScopeLensStore.getState().signOut();

    const state = useScopeLensStore.getState();
    expect(state.user).toBeNull();
    expect(state.reports).toEqual([]);
    expect(state.cloudProjects).toEqual([]);
    expect(state.adminUsers).toEqual([]);
    expect(state.adminProjects).toEqual([]);
    expect(state.adminReportsCount).toBe(0);
    expect(state.lastSyncedAt).toBeNull();
    expect(state.project.isDemo).toBe(true);
    expect(state.project.name).toBe('Website Company Profile');
  });

  it('selectCloudProject dengan fromRealtime: true tidak menimpa draft lokal yang sedang diedit', async () => {
    const projectId = '11111111-1111-4111-8111-111111111111';
    const baseProj = {
      ...createDemoProject(),
      id: projectId,
      name: 'Versi Awal',
      isDemo: false,
    };

    useScopeLensStore.setState({
      project: baseProj,
      hasUnsavedChanges: false,
      isSaving: false,
    });

    let resolveFetch!: (val: unknown) => void;
    const fetchPromise = new Promise((res) => {
      resolveFetch = res;
    });

    const fakeClient = {
      from: vi.fn((table: string) => {
        if (table === 'projects') {
          return {
            select: () => ({
              eq: () => ({
                single: () => fetchPromise,
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: () => Promise.resolve({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }),
    };

    vi.spyOn(supabaseLib, 'getSupabaseClient').mockReturnValue(
      fakeClient as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>
    );

    // Mulai silent realtime refresh
    const refreshCall = useScopeLensStore
      .getState()
      .selectCloudProject(projectId, { silent: true, fromRealtime: true });

    // Pengguna mengetik perubahan lokal SEBELUM fetch selesai
    useScopeLensStore.getState().updateProjectMeta({ name: 'Editan Lokal Terbaru' });
    expect(useScopeLensStore.getState().hasUnsavedChanges).toBe(true);

    // Fetch selesai membawa data lama dari server
    resolveFetch({
      data: {
        id: projectId,
        user_id: 'user-1',
        project_name: 'Versi Lama Server',
        client_name: 'Klien',
        project_category: 'Web Development',
        project_description: '',
        start_date: '2026-11-16',
        original_deadline: '2026-11-23',
        initial_price: 1500000,
        hourly_rate: 75000,
        productive_hours_per_day: 6,
        work_days: [1, 2, 3, 4, 5],
        holidays: [],
        currency: 'IDR',
        status: 'active',
        updated_at: '2026-11-16T10:00:00Z',
      },
      error: null,
    });

    const applied = await refreshCall;
    expect(applied).toBe(false);
    expect(useScopeLensStore.getState().project.name).toBe('Editan Lokal Terbaru');
    expect(useScopeLensStore.getState().hasUnsavedChanges).toBe(true);
  });

  it('deleteCloudProject menangani kegagalan backend dengan toast error tanpa unhandled rejection', async () => {
    const fakeClient = {
      from: vi.fn(() => ({
        delete: () => ({
          eq: () => Promise.resolve({ error: { message: 'permission denied for table projects' } }),
        }),
      })),
    };

    vi.spyOn(supabaseLib, 'getSupabaseClient').mockReturnValue(
      fakeClient as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>
    );

    await expect(
      useScopeLensStore.getState().deleteCloudProject('11111111-1111-4111-8111-111111111111')
    ).resolves.toBeUndefined();

    expect(useScopeLensStore.getState().toastMessage?.type).toBe('error');
    expect(useScopeLensStore.getState().toastMessage?.text).toContain('tidak memiliki izin');
  });

  it('updateUserRole saat Admin menurunkan perannya sendiri membersihkan state admin dan meresubscribe channel', async () => {
    const admin1: UserProfile = {
      id: 'admin-1',
      email: 'admin1@scopelens.id',
      fullName: 'Admin Satu',
      role: 'admin',
    };
    const admin2: UserProfile = {
      id: 'admin-2',
      email: 'admin2@scopelens.id',
      fullName: 'Admin Dua',
      role: 'admin',
    };

    const fakeChannel = {
      on: vi.fn(() => fakeChannel),
      subscribe: vi.fn((cb: (status: string) => void) => {
        cb('SUBSCRIBED');
        return fakeChannel;
      }),
    };

    const fakeClient = {
      channel: vi.fn(() => fakeChannel),
      removeChannel: vi.fn(async () => 'ok'),
      rpc: vi.fn(async () => ({
        data: {
          id: admin1.id,
          email: admin1.email,
          full_name: admin1.fullName,
          role: 'user',
          created_at: '2026-11-10T00:00:00Z',
          updated_at: '2026-11-16T10:00:00Z',
        },
        error: null,
      })),
    };

    vi.spyOn(supabaseLib, 'getSupabaseClient').mockReturnValue(
      fakeClient as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>
    );

    useScopeLensStore.setState({
      user: admin1,
      adminUsers: [admin1, admin2],
      adminReportsCount: 4,
    });

    await useScopeLensStore.getState().updateUserRole(admin1.id, 'user');

    const state = useScopeLensStore.getState();
    expect(state.user?.role).toBe('user');
    expect(state.adminUsers).toEqual([]);
    expect(state.adminProjects).toEqual([]);
    expect(state.adminReportsCount).toBe(0);
  });

  it('loadCloudProjects otomatis memuat proyek asli pertama dari PostgreSQL dan tetap menjaga empty state bila 0 proyek', async () => {
    const realProjectId = '44444444-4444-4444-8444-444444444444';
    const userId = 'user-cloud-1';

    let returnEmpty = true;
    const fakeClient = {
      from: vi.fn((table: string) => {
        if (table === 'projects') {
          return {
            select: () => ({
              order: () => ({
                range: () => ({
                  eq: async () => ({
                    data: returnEmpty
                      ? []
                      : [
                          {
                            id: realProjectId,
                            user_id: userId,
                            project_name: 'Portal Akademik Asli',
                            client_name: 'Universitas Nusantara',
                            project_category: 'Web Development',
                            project_description: '',
                            start_date: '2026-11-16',
                            original_deadline: '2026-11-23',
                            initial_price: 5000000,
                            hourly_rate: 125000,
                            productive_hours_per_day: 6,
                            work_days: [1, 2, 3, 4, 5],
                            holidays: [],
                            currency: 'IDR',
                            status: 'active',
                            updated_at: '2026-11-16T10:00:00Z',
                          },
                        ],
                    error: null,
                    count: returnEmpty ? 0 : 1,
                  }),
                }),
              }),
              eq: () => ({
                single: async () => ({
                  data: {
                    id: realProjectId,
                    user_id: userId,
                    project_name: 'Portal Akademik Asli',
                    client_name: 'Universitas Nusantara',
                    project_category: 'Web Development',
                    project_description: '',
                    start_date: '2026-11-16',
                    original_deadline: '2026-11-23',
                    initial_price: 5000000,
                    hourly_rate: 125000,
                    productive_hours_per_day: 6,
                    work_days: [1, 2, 3, 4, 5],
                    holidays: [],
                    currency: 'IDR',
                    status: 'active',
                    updated_at: '2026-11-16T10:00:00Z',
                  },
                  error: null,
                }),
              }),
            }),
            delete: () => ({
              eq: async () => ({ error: null }),
            }),
          };
        }
        return {
          select: () => ({
            in: () => ({
              order: async () => ({ data: [], error: null }),
            }),
            eq: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: () => Promise.resolve({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }),
    };

    vi.spyOn(supabaseLib, 'getSupabaseClient').mockReturnValue(
      fakeClient as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>
    );

    useScopeLensStore.setState({
      user: { id: userId, email: 'cloud@scopelens.id', fullName: 'Cloud User', role: 'user' },
      supabaseReady: true,
      hasLoadedCloudOnce: false,
      hasUnsavedChanges: false,
    });

    // 1. Saat 0 proyek di PostgreSQL: hasLoadedCloudOnce = true, cloudProjects = [], project tetap isDemo (memicu Empty State)
    await useScopeLensStore.getState().loadCloudProjects();
    expect(useScopeLensStore.getState().hasLoadedCloudOnce).toBe(true);
    expect(useScopeLensStore.getState().cloudProjects).toHaveLength(0);
    expect(useScopeLensStore.getState().project.isDemo).toBe(true);

    // 2. Saat sudah ada proyek asli di PostgreSQL: otomatis memuat proyek asli pertama (isDemo = false)
    returnEmpty = false;
    await useScopeLensStore.getState().loadCloudProjects();
    expect(useScopeLensStore.getState().cloudProjects).toHaveLength(1);
    expect(useScopeLensStore.getState().project.id).toBe(realProjectId);
    expect(useScopeLensStore.getState().project.name).toBe('Portal Akademik Asli');
    expect(useScopeLensStore.getState().project.isDemo).toBe(false);

    // 3. Menghapus proyek terakhir: kembali ke kondisi empty state (cloudProjects = [], project.isDemo = true)
    returnEmpty = true;
    await useScopeLensStore.getState().deleteCloudProject(realProjectId);
    expect(useScopeLensStore.getState().cloudProjects).toHaveLength(0);
    expect(useScopeLensStore.getState().project.isDemo).toBe(true);
  });

  it('loadCloudProjects mencatat cloudLoadError dan menampilkan toast error saat query Supabase gagal', async () => {
    const fakeClient = {
      from: vi.fn(() => ({
        select: () => ({
          order: () => ({
            range: () => ({
              eq: async () => ({
                data: null,
                error: { message: 'network timeout' },
                count: null,
              }),
            }),
          }),
        }),
      })),
    };

    vi.spyOn(supabaseLib, 'getSupabaseClient').mockReturnValue(
      fakeClient as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>
    );

    useScopeLensStore.setState({
      user: { id: 'user-err', email: 'err@scopelens.id', fullName: 'Err User', role: 'user' },
      supabaseReady: true,
      hasLoadedCloudOnce: false,
      cloudLoadError: null,
    });

    await useScopeLensStore.getState().loadCloudProjects();

    const state = useScopeLensStore.getState();
    expect(state.hasLoadedCloudOnce).toBe(true);
    expect(state.isLoadingCloud).toBe(false);
    expect(state.cloudLoadError).toContain('network timeout');
    expect(state.toastMessage?.type).toBe('error');
  });

  it('signOut selalu menegakkan isDemo: true meski localStorage menyimpan objek dengan isDemo: false', async () => {
    const sample = createDemoProject();
    window.localStorage.setItem(
      'scopelens_active_project_v3',
      JSON.stringify({ ...sample, isDemo: false, userId: 'old-user' })
    );

    useScopeLensStore.setState({
      user: { id: 'u-1', email: 'u1@scopelens.id', fullName: 'User One', role: 'user' },
      project: { ...sample, id: '11111111-1111-4111-8111-111111111111', isDemo: false },
    });

    await useScopeLensStore.getState().signOut();

    const state = useScopeLensStore.getState();
    expect(state.project.isDemo).toBe(true);
    expect(state.project.userId).toBeNull();
  });
});
