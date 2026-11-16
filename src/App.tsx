import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  ChevronDown,
  CopyPlus,
  FolderKanban,
  FolderPlus,
  LogIn,
  Plus,
  Printer,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { LandingBento } from './components/LandingBento';
import { MetricSparklineCards } from './components/MetricSparklineCards';
import { ProjectListDrawer } from './components/ProjectListDrawer';
import { ProjectSettingsModal } from './components/ProjectSettingsModal';
import { ReportPreviewModal } from './components/ReportPreviewModal';
import { RightNegotiationPanel } from './components/RightNegotiationPanel';
import { ScopeItemModal } from './components/ScopeItemModal';
import { ScopeMascot, type MascotMood } from './components/ScopeMascot';
import { ScopeWorkspace } from './components/ScopeWorkspace';
import { SideRail } from './components/SideRail';
import { createDemoProject } from './data/demoSeed';
import { generateNegotiationMessages, simulateNegotiation } from './engine';
import {
  formatCompactRupiah,
  formatHours,
  formatIndonesianDate,
  formatRupiah,
} from './lib/formatters';
import { useScopeLensStore } from './stores/useScopeLensStore';
import type { ItemType, WorkItem } from './types';

export function App() {
  const {
    project,
    baselineLocked,
    hasUnsavedChanges,
    isSaving,
    isLoadingCloud,
    hasLoadedCloudOnce,
    cloudLoadError,
    toastMessage,
    user,
    cloudProjects,
    reports,
    supabaseReady,
    realtimeStatus,
    lastSyncedAt,
    adminUsers,
    adminProjects,
    adminReportsCount,
    isLoadingAdmin,
    clearToast,
    toggleBaselineLock,
    updateProjectMeta,
    addScopeItem,
    updateScopeItemLocal,
    removeScopeItemLocal,
    setNegotiationStrategy,
    toggleSwappedOutItem,
    toggleDeferredRequest,
    toggleExcludedRequest,
    resetDemo,
    saveWorkspace,
    createReportSnapshot,
    refreshReports,
    initAuth,
    signIn,
    signUp,
    signOut,
    loadCloudProjects,
    selectCloudProject,
    createNewProjectWorkspace,
    createSampleCloudProject,
    deleteCloudProject,
    switchToDemoMode,
    loadAdminData,
    updateUserRole,
    adminUpdateProjectStatus,
    adminDeleteProject,
  } = useScopeLensStore();

  const [activeView, setActiveView] = useState<'landing' | 'studio' | 'admin'>('landing');
  const [itemModalState, setItemModalState] = useState<{
    open: boolean;
    itemType: ItemType;
    editing: WorkItem | null;
  }>({ open: false, itemType: 'requested', editing: null });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  const [projectsDrawerOpen, setProjectsDrawerOpen] = useState(false);
  const [openNewProjectForm, setOpenNewProjectForm] = useState(false);
  const strategyPanelRef = useRef<HTMLDivElement | null>(null);
  const prevUserIdRef = useRef<string | null>(null);

  const isCloudAuthenticated = Boolean(user && supabaseReady);
  const isCloudEmptyWorkspace = isCloudAuthenticated && Boolean(project.isDemo);
  const hasActiveProject = !isCloudEmptyWorkspace && !(supabaseReady && !user);

  useEffect(() => {
    void initAuth();
    if (!supabaseReady) {
      void refreshReports();
    }
  }, [initAuth, refreshReports, supabaseReady]);

  // Alur otomatis: Landing Page -> setelah login masuk Dashboard -> setelah logout kembali ke Landing Page
  useEffect(() => {
    const prevId = prevUserIdRef.current;
    const nextId = user?.id ?? null;
    if (!prevId && nextId) {
      setActiveView('studio');
    } else if (prevId && !nextId) {
      setActiveView('landing');
      setProjectsDrawerOpen(false);
      setSettingsOpen(false);
      setReportOpen(false);
    }
    prevUserIdRef.current = nextId;
  }, [user]);

  useEffect(() => {
    if (supabaseReady && !user && activeView !== 'landing') {
      setActiveView('landing');
    } else if (activeView === 'admin' && user?.role !== 'admin') {
      setActiveView('studio');
    }
  }, [activeView, supabaseReady, user]);

  useEffect(() => {
    document.title =
      activeView === 'admin'
        ? 'Panel Kontrol Admin | ScopeLens'
        : activeView === 'studio'
          ? isCloudEmptyWorkspace
            ? 'Dashboard Proyek | ScopeLens'
            : `${project.name} — Analisis Ruang Lingkup | ScopeLens`
          : 'ScopeLens — Lindungi Kesepakatan & Margin Proyek Freelance';
  }, [activeView, isCloudEmptyWorkspace, project.name]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => clearToast(), 4200);
    return () => clearTimeout(timer);
  }, [toastMessage, clearToast]);

  const simulationBundle = useMemo(() => simulateNegotiation(project), [project]);
  const { analysis, active: activeSimulation, allStrategies } = simulationBundle;

  const landingShowcase = useMemo(() => {
    if (supabaseReady && !user) {
      const showcaseProject = createDemoProject();
      const showcaseSim = simulateNegotiation(showcaseProject);
      return {
        project: showcaseProject,
        analysis: showcaseSim.analysis,
        simulation: showcaseSim.active,
      };
    }
    return {
      project,
      analysis,
      simulation: activeSimulation,
    };
  }, [activeSimulation, analysis, project, supabaseReady, user]);

  const messages = useMemo(
    () => generateNegotiationMessages(project, analysis, activeSimulation),
    [project, analysis, activeSimulation]
  );

  // Mood & narasi hangat untuk Hero Banner + Maskot Lensy
  const heroInsight = useMemo((): {
    mood: MascotMood;
    badgeText: string;
    headline: string;
    body: string;
  } => {
    if (!analysis.hasScopeCreep) {
      return {
        mood: 'calm',
        badgeText: 'Sesuai Kesepakatan Awal',
        headline: 'Ruang lingkup masih aman dan sesuai kontrak',
        body: `Seluruh pekerjaan pada "${project.name}" berjalan sesuai kesepakatan awal (${formatHours(analysis.originalHours)} • ${formatCompactRupiah(project.initialPrice)}).`,
      };
    }

    if (project.negotiationStrategy === 'phase_2') {
      return {
        mood: 'strategist',
        badgeText: 'Strategi: Pindahkan ke Fase 2',
        headline: 'Anggaran dan tenggat Fase 1 tetap terlindungi',
        body: `${activeSimulation.phase2Items.length} permintaan baru (${formatHours(activeSimulation.phase2Hours)}) dijadwalkan ke kontrak Fase 2. Nilai Fase 1 tetap ${formatRupiah(activeSimulation.revisedPrice)}.`,
      };
    }

    if (project.negotiationStrategy === 'scope_swap') {
      const swappedCount = activeSimulation.swappedOutItems.length;
      return {
        mood: 'strategist',
        badgeText: 'Strategi: Tukar Fitur',
        headline:
          swappedCount > 0 && activeSimulation.additionalCostNow === 0
            ? 'Pertukaran fitur seimbang tanpa biaya tambahan'
            : swappedCount > 0
              ? `Tukar fitur aktif • Selisih ${formatCompactRupiah(activeSimulation.additionalCostNow, true)}`
              : 'Pilih fitur awal untuk ditukar',
        body:
          swappedCount > 0
            ? `${swappedCount} fitur awal (${formatHours(activeSimulation.swappedOutHours)}) ditukar keluar. Dampak biaya akhir ${activeSimulation.additionalCostNow > 0 ? '+' : ''}${formatRupiah(activeSimulation.additionalCostNow)} dengan target selesai ${formatIndonesianDate(activeSimulation.revisedDeadline)}.`
            : 'Centang item kesepakatan awal di panel kanan atau kolom kiri untuk melihat pengurangan biaya dan jam kerja secara langsung.',
      };
    }

    const activeCount = analysis.comparisons.filter(
      (c) => !project.excludedRequestIds.includes(c.item.id) && c.detectedStatus !== 'deferred'
    ).length;

    return {
      mood: 'alert',
      badgeText: `+${analysis.creepPercentage}% Beban Kerja Tambahan`,
      headline: `${activeCount} permintaan baru memengaruhi biaya dan jadwal`,
      body: `Total tambahan ${formatHours(activeSimulation.additionalHoursNow)} berdampak ${activeSimulation.additionalCostNow > 0 ? '+' : ''}${formatRupiah(activeSimulation.additionalCostNow)} dan menggeser target selesai ke ${formatIndonesianDate(activeSimulation.revisedDeadline)}.`,
    };
  }, [analysis, activeSimulation, project]);

  const handleExportPdf = async () => {
    const { exportScopeReportPdf } = await import('./lib/pdfExport');
    exportScopeReportPdf(project, analysis, activeSimulation);
  };

  const handleFocusNegotiation = () => {
    if (project.negotiationStrategy === 'accept_changes' && analysis.hasScopeCreep) {
      setNegotiationStrategy('scope_swap');
    }
    strategyPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const greetingName = user?.fullName?.trim()
    ? user.fullName.trim().split(' ')[0]
    : user?.email?.split('@')[0] || 'Freelancer';

  const openAuthWithMode = (mode: 'login' | 'register') => {
    setAuthInitialMode(mode);
    setAuthOpen(true);
  };

  const openCreateProjectDrawer = () => {
    setOpenNewProjectForm(true);
    setProjectsDrawerOpen(true);
  };

  const showSideRail = Boolean(user || activeView !== 'landing');

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink">
      <a
        href="#main-content"
        className="visually-hidden fixed top-2 left-2 z-50 rounded-xl bg-violetPrimary px-4 py-2 text-xs font-bold text-white shadow-lg"
      >
        Lewati ke konten utama
      </a>

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="no-print fixed bottom-20 lg:bottom-5 right-5 z-50 max-w-sm rounded-2xl border border-borderSoft bg-white px-4 py-3 shadow-cardHover flex items-center justify-between gap-3"
        >
          <span
            className={`text-xs sm:text-sm font-semibold ${
              toastMessage.type === 'error'
                ? 'text-rose-700'
                : toastMessage.type === 'success'
                  ? 'text-emerald-800'
                  : 'text-ink'
            }`}
          >
            {toastMessage.text}
          </span>
          <button
            type="button"
            onClick={clearToast}
            className="text-xs font-bold text-inkMuted hover:text-ink"
          >
            Tutup
          </button>
        </div>
      )}

      {/* 3-Zone Cozy Pastel Bento Shell */}
      <div className="flex-1 w-full max-w-[1440px] mx-auto px-3 sm:px-5 lg:px-6 py-4 sm:py-6 pb-24 lg:pb-8 flex flex-col lg:flex-row gap-5 items-start">
        {/* ZONA A: Slim Floating Left Icon Rail (tampil setelah masuk atau di Studio) */}
        {showSideRail && (
          <SideRail
            activeView={activeView}
            hasUnsavedChanges={hasUnsavedChanges}
            isSaving={isSaving}
            hasActiveProject={hasActiveProject}
            user={user}
            supabaseReady={supabaseReady}
            realtimeStatus={realtimeStatus}
            onChangeView={(nextView) => {
              if (supabaseReady && !user && nextView !== 'landing') {
                openAuthWithMode('login');
                return;
              }
              setActiveView(nextView);
            }}
            onOpenProjectsDrawer={() => {
              setOpenNewProjectForm(false);
              setProjectsDrawerOpen(true);
            }}
            onOpenReportPreview={() => {
              if (!hasActiveProject) {
                openCreateProjectDrawer();
                return;
              }
              setReportOpen(true);
            }}
            onOpenProjectSettings={() => {
              if (!hasActiveProject) {
                openCreateProjectDrawer();
                return;
              }
              setSettingsOpen(true);
            }}
            onSaveWorkspace={() => {
              if (!hasActiveProject) {
                openCreateProjectDrawer();
                return;
              }
              void saveWorkspace();
            }}
            onOpenAuthModal={() => openAuthWithMode('login')}
            onSignOut={() => void signOut()}
          />
        )}

        {/* MAIN CONTENT AREA */}
        <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 w-full">
          {activeView === 'admin' && user?.role === 'admin' ? (
            <AdminDashboard
              currentUser={user}
              users={adminUsers}
              projects={adminProjects}
              reportsCount={adminReportsCount}
              isLoading={isLoadingAdmin}
              realtimeStatus={realtimeStatus}
              lastSyncedAt={lastSyncedAt}
              onRefresh={loadAdminData}
              onUpdateUserRole={updateUserRole}
              onUpdateProjectStatus={adminUpdateProjectStatus}
              onDeleteProject={adminDeleteProject}
              onOpenProjectInStudio={async (projectId) => {
                const loaded = await selectCloudProject(projectId);
                if (loaded) {
                  setActiveView('studio');
                }
              }}
            />
          ) : activeView === 'landing' ? (
            <LandingBento
              project={landingShowcase.project}
              analysis={landingShowcase.analysis}
              simulation={landingShowcase.simulation}
              user={user}
              supabaseReady={supabaseReady}
              onStartStudio={() => {
                if (supabaseReady && !user) {
                  openAuthWithMode('login');
                  return;
                }
                setActiveView('studio');
              }}
              onOpenAdmin={() => {
                if (user?.role === 'admin') {
                  setActiveView('admin');
                }
              }}
              onOpenAuth={openAuthWithMode}
              onSignOut={() => void signOut()}
              onResetAndLoadSample={() => {
                resetDemo();
                setActiveView('studio');
              }}
            />
          ) : isCloudAuthenticated && project.isDemo && (!hasLoadedCloudOnce || isLoadingCloud) ? (
            <div className="rounded-[28px] bg-white p-8 sm:p-10 shadow-card flex flex-col items-center justify-center text-center space-y-3 min-h-[320px]">
              <div className="h-10 w-10 rounded-2xl bg-lavenderTint text-violetDeep flex items-center justify-center font-extrabold animate-pulse">
                SL
              </div>
              <h1 className="text-lg sm:text-xl font-extrabold text-ink">
                Menghubungkan ke database proyek Anda...
              </h1>
              <p className="text-xs sm:text-sm text-inkMuted max-w-md">
                Memeriksa proyek yang tersimpan di akun PostgreSQL Anda.
              </p>
            </div>
          ) : isCloudAuthenticated && project.isDemo && cloudLoadError ? (
            <div className="rounded-[28px] bg-white p-8 sm:p-10 shadow-card flex flex-col items-center justify-center text-center space-y-4 min-h-[320px]">
              <div className="h-10 w-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-extrabold">
                !
              </div>
              <div className="space-y-1.5">
                <h1 className="text-lg sm:text-xl font-extrabold text-ink">
                  Gagal memuat proyek dari Supabase
                </h1>
                <p className="text-xs sm:text-sm text-inkMuted max-w-md">{cloudLoadError}</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void loadCloudProjects()}
                  className="cta-focal-gradient inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-card min-h-[42px]"
                >
                  <RefreshCw className="w-4 h-4" aria-hidden="true" />
                  <span>Coba Muat Ulang</span>
                </button>
                {user?.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => setActiveView('admin')}
                    className="inline-flex items-center gap-1.5 rounded-full bg-lavenderTint px-4 py-2.5 text-xs sm:text-sm font-bold text-violetDeep hover:bg-violetPrimary hover:text-white studio-transition min-h-[42px]"
                  >
                    <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                    <span>Panel Kontrol Admin</span>
                  </button>
                )}
              </div>
            </div>
          ) : isCloudAuthenticated && project.isDemo && cloudProjects.length > 0 ? (
            <div className="rounded-[28px] bg-white p-8 sm:p-10 shadow-card flex flex-col items-center justify-center text-center space-y-4 min-h-[320px]">
              <div className="h-10 w-10 rounded-2xl bg-lavenderTint text-violetDeep flex items-center justify-center font-extrabold">
                <FolderKanban className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="space-y-1.5">
                <h1 className="text-lg sm:text-xl font-extrabold text-ink">
                  Anda memiliki {cloudProjects.length} proyek tersimpan
                </h1>
                <p className="text-xs sm:text-sm text-inkMuted max-w-md">
                  Pilih proyek dari database untuk mulai menganalisis perubahan ruang lingkup.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void selectCloudProject(cloudProjects[0].id)}
                  className="cta-focal-gradient inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-card min-h-[42px]"
                >
                  <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                  <span>Buka {cloudProjects[0].name}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenNewProjectForm(false);
                    setProjectsDrawerOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-lavenderTint px-4 py-2.5 text-xs sm:text-sm font-bold text-violetDeep hover:bg-violetPrimary hover:text-white studio-transition min-h-[42px]"
                >
                  <FolderKanban className="w-4 h-4" aria-hidden="true" />
                  <span>Pilih dari Daftar Proyek</span>
                </button>
              </div>
            </div>
          ) : isCloudEmptyWorkspace ? (
            <div className="space-y-5">
              {/* Header Dashboard Kosong */}
              <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-violetDeep">
                    Dashboard Proyek ScopeLens
                  </p>
                  <h1 className="text-2xl sm:text-[26px] font-extrabold text-ink mt-0.5 leading-tight">
                    Halo, {greetingName} 👋
                  </h1>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-inkMuted shadow-sm">
                      0 proyek tersimpan
                    </span>

                    {user && (
                      <button
                        type="button"
                        onClick={() => {
                          if (user.role === 'admin') setActiveView('admin');
                        }}
                        title={
                          user.role === 'admin'
                            ? 'Buka Panel Kontrol Admin'
                            : 'Masuk sebagai User'
                        }
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold shadow-sm ${
                          user.role === 'admin'
                            ? 'bg-violetPrimary text-white hover:bg-violetDeep cursor-pointer'
                            : 'bg-[#ECFDF5] text-[#047857] cursor-default'
                        }`}
                      >
                        {user.role === 'admin' && (
                          <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                        )}
                        <span>{user.role === 'admin' ? 'Panel Admin' : 'User'}</span>
                      </button>
                    )}

                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm ${
                        realtimeStatus === 'connected'
                          ? 'bg-white text-emerald-700'
                          : 'bg-white text-inkMuted'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`h-2 w-2 rounded-full ${
                          realtimeStatus === 'connected'
                            ? 'bg-emerald-500 animate-pulse'
                            : realtimeStatus === 'connecting'
                              ? 'bg-amber-400 animate-pulse'
                              : 'bg-slate-400'
                        }`}
                      />
                      <span>
                        {realtimeStatus === 'connected'
                          ? 'Live'
                          : realtimeStatus === 'connecting'
                            ? 'Menghubungkan'
                            : 'Terputus'}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  {user?.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => setActiveView('admin')}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-violetDeep shadow-card hover:bg-lavenderTint studio-transition min-h-[42px]"
                    >
                      <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                      <span>Panel Kontrol Admin</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={openCreateProjectDrawer}
                    className="cta-focal-gradient inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-card studio-transition min-h-[42px]"
                  >
                    <FolderPlus className="w-4 h-4" aria-hidden="true" />
                    <span>Buat Proyek Baru</span>
                  </button>
                </div>
              </header>

              {/* Empty State Focal Card */}
              <section
                aria-label="Buat proyek pertama Anda"
                className="hero-focal-gradient rounded-[28px] p-6 sm:p-8 text-white shadow-card flex flex-col sm:flex-row items-center justify-between gap-6 overflow-hidden"
              >
                <div className="flex-1 min-w-0 space-y-3 text-left">
                  <span className="inline-flex items-center rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-xs font-bold text-white">
                    Terhubung ke Database PostgreSQL
                  </span>

                  <h2 className="text-xl sm:text-2xl font-extrabold text-white leading-snug">
                    Belum ada proyek tersimpan di akun Anda
                  </h2>

                  <p className="text-xs sm:text-sm text-white/90 leading-relaxed max-w-xl">
                    Semua proyek, item kesepakatan awal, permintaan perubahan klien, dan arsip
                    laporan A4 akan disimpan secara nyata di akun Anda. Mulai dengan membuat proyek
                    pertama sekarang.
                  </p>

                  <div className="pt-1 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={openCreateProjectDrawer}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs sm:text-sm font-extrabold text-violetDeep shadow-sm hover:bg-lavenderTint studio-transition min-h-[42px]"
                    >
                      <FolderPlus className="w-4 h-4" aria-hidden="true" />
                      <span>Buat Proyek Pertama</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void createSampleCloudProject()}
                      className="inline-flex items-center gap-2 rounded-full bg-white/15 hover:bg-white/25 px-4 py-2.5 text-xs sm:text-sm font-bold text-white studio-transition min-h-[42px] disabled:opacity-60"
                    >
                      <CopyPlus className="w-4 h-4" aria-hidden="true" />
                      <span>
                        {isSaving ? 'Menyimpan Template...' : 'Salin Contoh Proyek ke Akun'}
                      </span>
                    </button>
                  </div>
                </div>

                <ScopeMascot variant="hero" mood="calm" />
              </section>

              {/* Ringkasan Sistem Nyata khusus Admin bila belum memiliki proyek pribadi */}
              {user?.role === 'admin' && (
                <section
                  aria-label="Ringkasan sistem untuk Admin"
                  className="rounded-[28px] bg-white p-6 shadow-card space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-violetDeep">
                        <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                        <span>Akses Administrator Aktif</span>
                      </div>
                      <h3 className="text-base sm:text-lg font-extrabold text-ink mt-0.5">
                        Data Asli Platform di Database
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveView('admin')}
                      className="inline-flex items-center gap-1.5 rounded-full bg-lavenderTint px-4 py-2 text-xs font-bold text-violetDeep hover:bg-violetPrimary hover:text-white studio-transition min-h-[38px]"
                    >
                      <span>Buka Panel Kontrol Admin</span>
                      <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-2xl bg-canvas p-4 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-inkMuted">Pengguna Terdaftar</span>
                        <p className="font-numeric text-xl font-extrabold text-ink mt-1">
                          {adminUsers.length}
                        </p>
                      </div>
                      <Users className="w-5 h-5 text-violetDeep" aria-hidden="true" />
                    </div>

                    <div className="rounded-2xl bg-canvas p-4 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-inkMuted">Total Proyek Sistem</span>
                        <p className="font-numeric text-xl font-extrabold text-ink mt-1">
                          {adminProjects.length}
                        </p>
                      </div>
                      <FolderKanban className="w-5 h-5 text-violetDeep" aria-hidden="true" />
                    </div>

                    <div className="rounded-2xl bg-canvas p-4 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-inkMuted">Snapshot Laporan</span>
                        <p className="font-numeric text-xl font-extrabold text-ink mt-1">
                          {adminReportsCount}
                        </p>
                      </div>
                      <Printer className="w-5 h-5 text-violetDeep" aria-hidden="true" />
                    </div>
                  </div>

                  {adminProjects.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <p className="text-xs font-bold text-inkMuted">
                        Proyek Pengguna Terbaru di Database
                      </p>
                      <div className="space-y-2">
                        {adminProjects.slice(0, 3).map((ap) => (
                          <div
                            key={ap.id}
                            className="rounded-2xl bg-canvas/80 px-4 py-3 flex flex-wrap items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-ink truncate">{ap.name}</p>
                              <p className="text-xs text-inkMuted">
                                {ap.clientName} • Pemilik: {ap.ownerName || ap.ownerEmail || 'Pengguna'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void selectCloudProject(ap.id)}
                              className="inline-flex items-center gap-1 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-violetDeep shadow-sm hover:bg-lavenderTint studio-transition"
                            >
                              <span>Buka di Studio</span>
                              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}
            </div>
          ) : (
            <div className="flex flex-col xl:flex-row gap-5 items-start">
              {/* ZONA B: Main Bento Workspace */}
              <div className="flex-1 min-w-0 w-full space-y-5">
                {/* 1. Top Greeting & Project Switcher Bar */}
                <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-violetDeep">
                      Analisis Perubahan Ruang Lingkup
                    </p>
                    <h1 className="text-2xl sm:text-[26px] font-extrabold text-ink mt-0.5 leading-tight">
                      Halo, {greetingName} 👋
                    </h1>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenNewProjectForm(false);
                          setProjectsDrawerOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-inkMuted hover:text-ink shadow-sm studio-transition max-w-full"
                      >
                        <span className="truncate">
                          <strong className="text-ink">{project.name}</strong> • {project.clientName}
                        </span>
                        <ChevronDown className="w-3.5 h-3.5 shrink-0 text-violetDeep" aria-hidden="true" />
                      </button>

                      {user ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              if (user.role === 'admin') setActiveView('admin');
                            }}
                            title={
                              user.role === 'admin'
                                ? 'Buka Panel Kontrol Admin'
                                : 'Masuk sebagai User'
                            }
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm ${
                              user.role === 'admin'
                                ? 'bg-violetPrimary text-white hover:bg-violetDeep cursor-pointer'
                                : 'bg-[#ECFDF5] text-[#047857] cursor-default'
                            }`}
                          >
                            {user.role === 'admin' && (
                              <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                            )}
                            <span>{user.role === 'admin' ? 'Panel Admin' : 'User'}</span>
                          </button>

                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm ${
                              realtimeStatus === 'connected'
                                ? 'bg-white text-emerald-700'
                                : 'bg-white text-inkMuted'
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className={`h-2 w-2 rounded-full ${
                                realtimeStatus === 'connected'
                                  ? 'bg-emerald-500 animate-pulse'
                                  : realtimeStatus === 'connecting'
                                    ? 'bg-amber-400 animate-pulse'
                                    : 'bg-slate-400'
                              }`}
                            />
                            <span>
                              {realtimeStatus === 'connected'
                                ? 'Live'
                                : realtimeStatus === 'connecting'
                                  ? 'Menghubungkan'
                                  : 'Terputus'}
                            </span>
                          </span>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openAuthWithMode('login')}
                          className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-violetDeep hover:bg-lavenderTint shadow-sm studio-transition"
                        >
                          <LogIn className="w-3 h-3" aria-hidden="true" />
                          <span>{supabaseReady ? 'Masuk Akun' : 'Penyimpanan Lokal'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Hanya 2 aksi utama */}
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setItemModalState({ open: true, itemType: 'requested', editing: null })
                      }
                      className="cta-focal-gradient inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-card studio-transition min-h-[42px]"
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                      <span>Permintaan Baru</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReportOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-ink shadow-card hover:bg-lavenderTint studio-transition min-h-[42px]"
                    >
                      <Printer className="w-4 h-4 text-violetDeep" aria-hidden="true" />
                      <span>Cetak Laporan A4</span>
                    </button>
                  </div>
                </header>

                {/* 2. Lavender Focal Hero Banner (Satu-satunya area gradasi utama) */}
                <section
                  aria-label="Ringkasan kondisi ruang lingkup proyek"
                  className="hero-focal-gradient rounded-[28px] p-6 sm:p-7 text-white shadow-card flex flex-col sm:flex-row items-center justify-between gap-5 overflow-hidden"
                >
                  <div className="flex-1 min-w-0 space-y-3 text-left">
                    <span className="inline-flex items-center rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-xs font-bold text-white">
                      {heroInsight.badgeText}
                    </span>

                    <h2 className="text-xl sm:text-2xl font-extrabold text-white leading-snug">
                      {heroInsight.headline}
                    </h2>

                    <p className="text-xs sm:text-sm text-white/90 leading-relaxed max-w-xl">
                      {heroInsight.body}
                    </p>

                    <div className="pt-1 flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handleFocusNegotiation}
                        className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-xs sm:text-sm font-extrabold text-violetDeep shadow-sm hover:bg-lavenderTint studio-transition min-h-[40px]"
                      >
                        Simulasikan Negosiasi
                      </button>

                      <span className="font-numeric text-xs font-semibold text-white/85 px-1">
                        Tarif {formatRupiah(project.hourlyRate)}/jam • {project.productiveHoursPerDay} jam/hari
                      </span>
                    </div>
                  </div>

                  <ScopeMascot variant="hero" mood={heroInsight.mood} />
                </section>

                {/* 3. 3 Kartu Metrik Sparkline */}
                <MetricSparklineCards
                  project={project}
                  analysis={analysis}
                  simulation={activeSimulation}
                />

                {/* 4. Perbandingan Ruang Lingkup (2 Kolom Kartu Tactile) */}
                <ScopeWorkspace
                  project={project}
                  analysis={analysis}
                  simulation={activeSimulation}
                  baselineLocked={baselineLocked}
                  onToggleBaselineLock={toggleBaselineLock}
                  onOpenAddModal={(type) =>
                    setItemModalState({ open: true, itemType: type, editing: null })
                  }
                  onOpenEditModal={(type, item) =>
                    setItemModalState({ open: true, itemType: type, editing: item })
                  }
                  onDeleteItem={removeScopeItemLocal}
                  onQuickUpdateHours={(type, id, hours) =>
                    updateScopeItemLocal(type, id, { estimatedHours: hours })
                  }
                  onToggleDeferred={toggleDeferredRequest}
                  onToggleExcluded={toggleExcludedRequest}
                  onToggleSwapItem={toggleSwappedOutItem}
                />
              </div>

              {/* ZONA C: Right Panel — Strategi Negosiasi & Pesan Siap Kirim */}
              <div ref={strategyPanelRef} className="w-full xl:w-[390px] 2xl:w-[420px] shrink-0">
                <RightNegotiationPanel
                  project={project}
                  analysis={analysis}
                  activeStrategy={project.negotiationStrategy}
                  allStrategies={allStrategies}
                  messages={messages}
                  onSelectStrategy={setNegotiationStrategy}
                  onToggleSwapItem={toggleSwappedOutItem}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Footer Minimalis */}
      <footer className="no-print pb-24 lg:pb-6 pt-2 text-center text-xs font-medium text-inkMuted">
        ScopeLens — Lindungi Kesepakatan &amp; Margin Proyek Freelance
      </footer>

      {/* Modals */}
      {hasActiveProject && (
        <>
          <ScopeItemModal
            open={itemModalState.open}
            itemType={itemModalState.itemType}
            editingItem={itemModalState.editing}
            baselineItems={project.originalItems}
            onClose={() => setItemModalState((s) => ({ ...s, open: false }))}
            onSubmit={(payload) => {
              if (itemModalState.editing) {
                updateScopeItemLocal(
                  itemModalState.itemType,
                  itemModalState.editing.id,
                  payload
                );
              } else {
                addScopeItem(itemModalState.itemType, payload);
              }
            }}
          />

          <ProjectSettingsModal
            open={settingsOpen}
            project={project}
            onClose={() => setSettingsOpen(false)}
            onSave={updateProjectMeta}
          />

          <ReportPreviewModal
            open={reportOpen}
            project={project}
            analysis={analysis}
            simulation={activeSimulation}
            reports={reports}
            onClose={() => setReportOpen(false)}
            onExportPdf={() => void handleExportPdf()}
            onSaveSnapshot={() => void createReportSnapshot()}
          />
        </>
      )}

      <AuthModal
        open={authOpen}
        supabaseReady={supabaseReady}
        initialMode={authInitialMode}
        onClose={() => setAuthOpen(false)}
        onSignIn={signIn}
        onSignUp={signUp}
      />

      {(!supabaseReady || user) && (
        <ProjectListDrawer
          open={projectsDrawerOpen}
          initialShowNewForm={openNewProjectForm}
          activeProjectId={hasActiveProject ? project.id : ''}
          user={user}
          supabaseReady={supabaseReady}
          cloudProjects={cloudProjects}
          onClose={() => {
            setProjectsDrawerOpen(false);
            setOpenNewProjectForm(false);
          }}
          onLoadSampleCase={switchToDemoMode}
          onCreateSampleCloudProject={createSampleCloudProject}
          onSelectCloudProject={(id) => void selectCloudProject(id)}
          onCreateProject={createNewProjectWorkspace}
          onDeleteCloudProject={deleteCloudProject}
        />
      )}
    </div>
  );
}

export default App;
