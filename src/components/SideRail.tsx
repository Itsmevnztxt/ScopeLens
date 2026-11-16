import React from 'react';
import scopeLogo from '../assets/mascot/logo.png';
import {
  Cloud,
  FileText,
  FolderKanban,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  Save,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import type { RealtimeConnectionStatus, UserProfile } from '../types';

interface SideRailProps {
  activeView: 'landing' | 'studio' | 'admin';
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  hasActiveProject?: boolean;
  user: UserProfile | null;
  supabaseReady: boolean;
  realtimeStatus: RealtimeConnectionStatus;
  onChangeView: (view: 'landing' | 'studio' | 'admin') => void;
  onOpenProjectsDrawer: () => void;
  onOpenReportPreview: () => void;
  onOpenProjectSettings: () => void;
  onSaveWorkspace: () => void;
  onOpenAuthModal: () => void;
  onSignOut: () => void;
}

export const SideRail: React.FC<SideRailProps> = ({
  activeView,
  hasUnsavedChanges,
  isSaving,
  hasActiveProject = true,
  user,
  supabaseReady,
  realtimeStatus,
  onChangeView,
  onOpenProjectsDrawer,
  onOpenReportPreview,
  onOpenProjectSettings,
  onSaveWorkspace,
  onOpenAuthModal,
  onSignOut,
}) => {
  const isAdmin = user?.role === 'admin';
  const desktopBtnBase =
    'relative inline-flex h-12 w-12 items-center justify-center rounded-2xl studio-transition focus-visible:outline-violetPrimary';
  const inactiveDesktop =
    'text-inkMuted hover:text-violetDeep hover:bg-lavenderTint';
  const activeDesktop =
    'bg-violetPrimary text-white shadow-[0_8px_20px_-6px_rgba(139,92,246,0.55)]';

  return (
    <>
      {/* DESKTOP: Slim Floating Left Icon Rail (Zona A) */}
      <aside
        aria-label="Navigasi samping ScopeLens"
        className="no-print hidden lg:flex flex-col items-center justify-between w-20 shrink-0 rounded-[28px] bg-white py-5 px-2 shadow-rail sticky top-6 h-[calc(100dvh-3rem)]"
      >
        <div className="flex flex-col items-center gap-3 w-full">
          {/* Logo ScopeLens */}
          <button
            type="button"
            onClick={() => onChangeView('studio')}
            title="ScopeLens — Ruang Analisis"
            aria-label="Logo ScopeLens — Buka ruang analisis"
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl p-0.5 hover:scale-105 studio-transition overflow-hidden"
          >
            <img
              src={scopeLogo}
              alt="Logo ScopeLens"
              className="w-full h-full object-contain"
            />
          </button>

          <div className="w-8 h-px bg-borderSoft my-1" aria-hidden="true" />

          <nav aria-label="Navigasi utama" className="flex flex-col items-center gap-2.5 w-full">
            <button
              type="button"
              onClick={() => onChangeView('studio')}
              aria-current={activeView === 'studio' ? 'page' : undefined}
              aria-label="Workspace Analisis"
              title="Workspace Analisis"
              className={`${desktopBtnBase} ${
                activeView === 'studio' ? activeDesktop : inactiveDesktop
              }`}
            >
              <LayoutDashboard className="w-5 h-5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onOpenProjectsDrawer}
              aria-label="Daftar Proyek Tersimpan"
              title="Daftar Proyek Tersimpan"
              className={`${desktopBtnBase} ${inactiveDesktop}`}
            >
              <FolderKanban className="w-5 h-5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onOpenReportPreview}
              disabled={!hasActiveProject}
              aria-label="Pratinjau Laporan PDF"
              title={hasActiveProject ? 'Pratinjau Laporan PDF' : 'Buat proyek terlebih dahulu'}
              className={`${desktopBtnBase} ${inactiveDesktop} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <FileText className="w-5 h-5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onOpenProjectSettings}
              disabled={!hasActiveProject}
              aria-label="Pengaturan Tarif & Jam Kerja"
              title={hasActiveProject ? 'Pengaturan Tarif & Jam Kerja' : 'Buat proyek terlebih dahulu'}
              className={`${desktopBtnBase} ${inactiveDesktop} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <SlidersHorizontal className="w-5 h-5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => onChangeView('landing')}
              aria-current={activeView === 'landing' ? 'page' : undefined}
              aria-label="Beranda & Ringkasan"
              title="Beranda & Ringkasan"
              className={`${desktopBtnBase} ${
                activeView === 'landing' ? activeDesktop : inactiveDesktop
              }`}
            >
              <Home className="w-5 h-5" aria-hidden="true" />
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => onChangeView('admin')}
                aria-current={activeView === 'admin' ? 'page' : undefined}
                aria-label="Panel Kontrol Admin"
                title="Panel Kontrol Admin"
                className={`${desktopBtnBase} ${
                  activeView === 'admin'
                    ? activeDesktop
                    : 'bg-lavenderTint text-violetDeep hover:bg-violetPrimary hover:text-white'
                }`}
              >
                <ShieldCheck className="w-5 h-5" aria-hidden="true" />
              </button>
            )}
          </nav>
        </div>

        {/* Bottom Utility Actions */}
        <div className="flex flex-col items-center gap-2.5 w-full">
          <button
            type="button"
            onClick={onSaveWorkspace}
            disabled={isSaving || !hasActiveProject}
            aria-label={hasUnsavedChanges ? 'Simpan perubahan proyek' : 'Perubahan tersimpan'}
            title={
              !hasActiveProject
                ? 'Buat proyek terlebih dahulu'
                : hasUnsavedChanges
                  ? 'Simpan perubahan'
                  : 'Tersimpan'
            }
            className={`${desktopBtnBase} ${inactiveDesktop} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <Save className="w-5 h-5" aria-hidden="true" />
            {hasUnsavedChanges && (
              <span
                aria-hidden="true"
                className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white"
              />
            )}
          </button>

          {user ? (
            <button
              type="button"
              onClick={onSignOut}
              aria-label={`Keluar akun (${user.email})`}
              title={`Keluar (${user.email} • ${user.role === 'admin' ? 'Admin' : 'User'})`}
              className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl text-inkMuted hover:text-rose-600 hover:bg-rose-50 studio-transition"
            >
              <LogOut className="w-5 h-5" aria-hidden="true" />
              <span
                aria-hidden="true"
                className={`absolute top-2.5 right-2.5 h-2 w-2 rounded-full ring-2 ring-white ${
                  realtimeStatus === 'connected'
                    ? 'bg-emerald-500'
                    : realtimeStatus === 'connecting'
                      ? 'bg-amber-400'
                      : 'bg-slate-400'
                }`}
              />
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuthModal}
              aria-label={supabaseReady ? 'Masuk atau daftar akun cloud' : 'Status penyimpanan lokal'}
              title={supabaseReady ? 'Masuk / Daftar Cloud' : 'Penyimpanan Lokal & Cloud'}
              className={`${desktopBtnBase} ${inactiveDesktop}`}
            >
              {supabaseReady ? (
                <LogIn className="w-5 h-5" aria-hidden="true" />
              ) : (
                <Cloud className="w-5 h-5" aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      </aside>

      {/* MOBILE: Fixed Bottom Navigation Bar */}
      <nav
        aria-label="Navigasi cepat mobile"
        className="no-print lg:hidden fixed bottom-3 inset-x-3 z-40 rounded-[24px] bg-white/95 backdrop-blur-md shadow-cardHover border border-borderSoft px-2 py-1.5 flex items-center justify-around"
      >
        <button
          type="button"
          onClick={() => onChangeView('studio')}
          aria-current={activeView === 'studio' ? 'page' : undefined}
          className={`flex flex-col items-center justify-center min-h-[44px] min-w-[54px] rounded-2xl px-2.5 py-1 text-[11px] font-bold studio-transition ${
            activeView === 'studio'
              ? 'bg-violetPrimary text-white'
              : 'text-inkMuted hover:text-ink'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 mb-0.5" aria-hidden="true" />
          <span>Analisis</span>
        </button>

        <button
          type="button"
          onClick={onOpenProjectsDrawer}
          className="flex flex-col items-center justify-center min-h-[44px] min-w-[54px] rounded-2xl px-2.5 py-1 text-[11px] font-semibold text-inkMuted hover:text-ink studio-transition"
        >
          <FolderKanban className="w-4 h-4 mb-0.5" aria-hidden="true" />
          <span>Proyek</span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => onChangeView('admin')}
            aria-current={activeView === 'admin' ? 'page' : undefined}
            className={`flex flex-col items-center justify-center min-h-[44px] min-w-[54px] rounded-2xl px-2.5 py-1 text-[11px] font-bold studio-transition ${
              activeView === 'admin'
                ? 'bg-violetPrimary text-white'
                : 'text-inkMuted hover:text-ink'
            }`}
          >
            <ShieldCheck className="w-4 h-4 mb-0.5" aria-hidden="true" />
            <span>Admin</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenReportPreview}
          disabled={!hasActiveProject}
          className="flex flex-col items-center justify-center min-h-[44px] min-w-[54px] rounded-2xl px-2.5 py-1 text-[11px] font-semibold text-inkMuted hover:text-ink studio-transition disabled:opacity-40"
        >
          <FileText className="w-4 h-4 mb-0.5" aria-hidden="true" />
          <span>Laporan</span>
        </button>

        <button
          type="button"
          onClick={onOpenProjectSettings}
          disabled={!hasActiveProject}
          className="flex flex-col items-center justify-center min-h-[44px] min-w-[54px] rounded-2xl px-2.5 py-1 text-[11px] font-semibold text-inkMuted hover:text-ink studio-transition disabled:opacity-40"
        >
          <SlidersHorizontal className="w-4 h-4 mb-0.5" aria-hidden="true" />
          <span>Tarif</span>
        </button>

        <button
          type="button"
          onClick={onSaveWorkspace}
          disabled={isSaving || !hasActiveProject}
          className="relative flex flex-col items-center justify-center min-h-[44px] min-w-[54px] rounded-2xl px-2.5 py-1 text-[11px] font-semibold text-inkMuted hover:text-ink studio-transition disabled:opacity-40"
        >
          <Save className="w-4 h-4 mb-0.5" aria-hidden="true" />
          <span>Simpan</span>
          {hasUnsavedChanges && (
            <span
              aria-hidden="true"
              className="absolute top-1.5 right-3 h-2 w-2 rounded-full bg-rose-500"
            />
          )}
        </button>
      </nav>
    </>
  );
};
