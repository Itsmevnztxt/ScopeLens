import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  FileText,
  FolderKanban,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { analyzeProjectScope } from '../engine';
import { formatCompactRupiah, formatShortDate } from '../lib/formatters';
import type {
  AdminProjectSummary,
  ProjectStatus,
  RealtimeConnectionStatus,
  UserProfile,
  UserRole,
} from '../types';

interface AdminDashboardProps {
  currentUser: UserProfile;
  users: UserProfile[];
  projects: AdminProjectSummary[];
  reportsCount: number;
  isLoading: boolean;
  realtimeStatus: RealtimeConnectionStatus;
  lastSyncedAt: string | null;
  onRefresh: () => Promise<void>;
  onUpdateUserRole: (targetUserId: string, newRole: UserRole) => Promise<void>;
  onUpdateProjectStatus: (projectId: string, status: ProjectStatus) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onOpenProjectInStudio: (projectId: string) => Promise<void>;
}

const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: 'Aktif',
  draft: 'Draf',
  completed: 'Selesai',
  archived: 'Arsip',
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  users,
  projects,
  reportsCount,
  isLoading,
  realtimeStatus,
  lastSyncedAt,
  onRefresh,
  onUpdateUserRole,
  onUpdateProjectStatus,
  onDeleteProject,
  onOpenProjectInStudio,
}) => {
  const [userSearch, setUserSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const adminCount = useMemo(
    () => users.filter((u) => u.role === 'admin').length,
    [users]
  );

  const creepProjectsCount = useMemo(
    () => projects.filter((p) => analyzeProjectScope(p).hasScopeCreep).length,
    [projects]
  );

  const activeProjectsCount = useMemo(
    () => projects.filter((p) => p.status === 'active').length,
    [projects]
  );

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.clientName.toLowerCase().includes(q) ||
        (p.ownerName ?? '').toLowerCase().includes(q) ||
        (p.ownerEmail ?? '').toLowerCase().includes(q)
      );
    });
  }, [projects, projectSearch, statusFilter]);

  const handleRoleToggle = async (target: UserProfile) => {
    setActionError(null);
    const nextRole: UserRole = target.role === 'admin' ? 'user' : 'admin';
    setBusyUserId(target.id);
    try {
      await onUpdateUserRole(target.id, nextRole);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal mengubah role pengguna.');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleStatusChange = async (projectId: string, nextStatus: ProjectStatus) => {
    setActionError(null);
    setBusyProjectId(projectId);
    try {
      await onUpdateProjectStatus(projectId, nextStatus);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal memperbarui status proyek.');
    } finally {
      setBusyProjectId(null);
    }
  };

  const handleDelete = async (projectId: string) => {
    setActionError(null);
    setBusyProjectId(projectId);
    try {
      await onDeleteProject(projectId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal menghapus proyek.');
    } finally {
      setBusyProjectId(null);
    }
  };

  const realtimeBadge =
    realtimeStatus === 'connected'
      ? {
          bg: 'bg-emerald-50 text-emerald-700',
          dot: 'bg-emerald-500 animate-pulse',
          label: 'Live Real-Time',
        }
      : realtimeStatus === 'connecting'
        ? {
            bg: 'bg-amber-50 text-amber-800',
            dot: 'bg-amber-500 animate-pulse',
            label: 'Menghubungkan...',
          }
        : realtimeStatus === 'unconfigured'
          ? {
              bg: 'bg-slate-100 text-slate-600',
              dot: 'bg-slate-400',
              label: 'Supabase Belum Terhubung',
            }
          : {
              bg: 'bg-slate-100 text-slate-600',
              dot: 'bg-slate-400',
              label: 'Sinkronisasi Terputus',
            };

  return (
    <section aria-label="Panel Kontrol Admin" className="space-y-5">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-violetDeep">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            <span>Panel Kontrol Admin</span>
          </div>
          <h1 className="text-2xl sm:text-[26px] font-extrabold text-ink mt-0.5 leading-tight">
            Manajemen Pengguna &amp; Proyek Real-Time
          </h1>
          <p className="text-xs sm:text-sm text-inkMuted mt-1">
            Kelola hak akses Admin/User dan pantau seluruh proyek aktif secara langsung dari database.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold ${realtimeBadge.bg}`}
          >
            <span className={`h-2 w-2 rounded-full ${realtimeBadge.dot}`} aria-hidden="true" />
            <span>{realtimeBadge.label}</span>
          </span>

          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-ink shadow-card hover:bg-lavenderTint studio-transition min-h-[40px] disabled:opacity-60"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-violetDeep ${isLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Segarkan Data</span>
          </button>
        </div>
      </header>

      {lastSyncedAt && (
        <p className="text-[11px] font-medium text-inkMuted px-1">
          Terakhir disinkronkan:{' '}
          <span className="font-numeric font-semibold text-ink">
            {new Date(lastSyncedAt).toLocaleTimeString('id-ID')}
          </span>
        </p>
      )}

      {actionError && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700"
        >
          {actionError}
        </div>
      )}

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-[24px] bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-inkMuted">Total Pengguna</span>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-lavenderTint text-violetDeep">
              <Users className="w-4 h-4" aria-hidden="true" />
            </span>
          </div>
          <p className="font-numeric text-2xl font-extrabold text-ink mt-2">{users.length}</p>
          <p className="font-numeric text-xs text-inkMuted mt-1">
            {adminCount} Admin • {Math.max(0, users.length - adminCount)} User
          </p>
        </div>

        <div className="rounded-[24px] bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-inkMuted">Total Proyek</span>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#E0F2FE] text-[#0284C7]">
              <FolderKanban className="w-4 h-4" aria-hidden="true" />
            </span>
          </div>
          <p className="font-numeric text-2xl font-extrabold text-ink mt-2">{projects.length}</p>
          <p className="font-numeric text-xs text-inkMuted mt-1">
            {activeProjectsCount} proyek berstatus aktif
          </p>
        </div>

        <div className="rounded-[24px] bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-inkMuted">Terdampak Tambahan</span>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF1F2] text-[#BE123C]">
              <Activity className="w-4 h-4" aria-hidden="true" />
            </span>
          </div>
          <p className="font-numeric text-2xl font-extrabold text-[#BE123C] mt-2">
            {creepProjectsCount}
          </p>
          <p className="text-xs text-inkMuted mt-1">Proyek dengan permintaan perubahan</p>
        </div>

        <div className="rounded-[24px] bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-inkMuted">Snapshot Laporan</span>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#ECFDF5] text-[#047857]">
              <FileText className="w-4 h-4" aria-hidden="true" />
            </span>
          </div>
          <p className="font-numeric text-2xl font-extrabold text-ink mt-2">{reportsCount}</p>
          <p className="text-xs text-inkMuted mt-1">Arsip laporan tersimpan di cloud</p>
        </div>
      </div>

      {/* Manajemen Pengguna (Admin & User Roles) */}
      <div className="rounded-[28px] bg-white p-5 sm:p-6 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-ink">
              Daftar Pengguna &amp; Hak Akses
            </h2>
            <p className="text-xs text-inkMuted mt-0.5">
              Setiap pendaftaran baru otomatis menjadi User. Hanya Admin yang dapat menaikkan atau menurunkan peran.
            </p>
          </div>

          <label className="relative block w-full sm:w-64">
            <span className="sr-only">Cari pengguna</span>
            <Search
              className="w-4 h-4 text-inkMuted absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Cari nama atau email..."
              className="w-full rounded-full border border-borderSoft bg-canvas pl-9 pr-3.5 py-2 text-xs text-ink"
            />
          </label>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="rounded-2xl bg-canvas p-6 text-center text-xs text-inkMuted">
            Tidak ada pengguna yang cocok dengan pencarian.
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredUsers.map((u) => {
              const isSelf = u.id === currentUser.id;
              const isLastAdmin = u.role === 'admin' && adminCount <= 1;
              const disabled = busyUserId === u.id || isLastAdmin;

              return (
                <div
                  key={u.id}
                  className="rounded-2xl bg-canvas/80 p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                        u.role === 'admin'
                          ? 'bg-lavenderTint text-violetDeep'
                          : 'bg-[#ECFDF5] text-[#047857]'
                      }`}
                    >
                      {u.role === 'admin' ? (
                        <ShieldCheck className="w-4 h-4" />
                      ) : (
                        <UserCheck className="w-4 h-4" />
                      )}
                    </span>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-ink truncate">
                          {u.fullName || 'Tanpa Nama'}
                        </span>
                        {isSelf && (
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-violetDeep shadow-sm">
                            Akun Anda
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            u.role === 'admin'
                              ? 'bg-violetPrimary text-white'
                              : 'bg-[#ECFDF5] text-[#047857]'
                          }`}
                        >
                          {u.role === 'admin' ? 'Admin' : 'User'}
                        </span>
                      </div>
                      <p className="text-xs text-inkMuted truncate mt-0.5">
                        {u.email}
                        {u.createdAt && (
                          <span className="font-numeric">
                            {' '}
                            • Bergabung {formatShortDate(u.createdAt.slice(0, 10))}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => void handleRoleToggle(u)}
                      title={
                        isSelf && isLastAdmin
                          ? 'Minimal harus ada satu Admin aktif'
                          : u.role === 'admin'
                            ? 'Ubah peran menjadi User biasa'
                            : 'Promosikan menjadi Admin'
                      }
                      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold studio-transition min-h-[36px] disabled:opacity-50 disabled:cursor-not-allowed ${
                        u.role === 'admin'
                          ? 'bg-white text-ink hover:bg-rose-50 hover:text-rose-700 shadow-sm'
                          : 'bg-lavenderTint text-violetDeep hover:bg-violetPrimary hover:text-white'
                      }`}
                    >
                      {u.role === 'admin' ? (
                        <>
                          <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{isLastAdmin ? 'Admin Terakhir' : 'Jadikan User'}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Jadikan Admin</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pemantauan Seluruh Proyek */}
      <div className="rounded-[28px] bg-white p-5 sm:p-6 shadow-card space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-ink">
              Pemantauan Proyek Lintas Pengguna
            </h2>
            <p className="text-xs text-inkMuted mt-0.5">
              Buka proyek mana saja ke dalam ruang analisis, perbarui status, atau bersihkan data.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full bg-canvas p-1 text-xs font-bold">
              {(['all', 'active', 'draft', 'completed', 'archived'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-full px-3 py-1.5 studio-transition ${
                    statusFilter === st
                      ? 'bg-white text-violetDeep shadow-sm'
                      : 'text-inkMuted hover:text-ink'
                  }`}
                >
                  {st === 'all' ? 'Semua' : PROJECT_STATUS_LABEL[st]}
                </button>
              ))}
            </div>

            <label className="relative block w-full sm:w-56">
              <span className="sr-only">Cari proyek</span>
              <Search
                className="w-4 h-4 text-inkMuted absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="search"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="Cari proyek atau pemilik..."
                className="w-full rounded-full border border-borderSoft bg-canvas pl-9 pr-3.5 py-2 text-xs text-ink"
              />
            </label>
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="rounded-2xl bg-canvas p-6 text-center text-xs text-inkMuted">
            Belum ada proyek yang sesuai filter saat ini.
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredProjects.map((proj) => {
              const analysis = analyzeProjectScope(proj);
              const isBusy = busyProjectId === proj.id;

              return (
                <div
                  key={proj.id}
                  className="rounded-2xl bg-canvas/80 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold text-ink truncate">{proj.name}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          analysis.hasScopeCreep
                            ? 'bg-[#FFF1F2] text-[#BE123C]'
                            : 'bg-[#ECFDF5] text-[#047857]'
                        }`}
                      >
                        {analysis.hasScopeCreep
                          ? `+${analysis.creepPercentage}% Tambahan`
                          : 'Sesuai Awal'}
                      </span>
                    </div>

                    <p className="text-xs text-inkMuted">
                      Klien: <strong className="text-ink">{proj.clientName}</strong> • Pemilik:{' '}
                      <strong className="text-ink">
                        {proj.ownerName || proj.ownerEmail || 'Pengguna'}
                      </strong>
                    </p>

                    <p className="font-numeric text-xs text-inkMuted">
                      Nilai Awal {formatCompactRupiah(proj.initialPrice)} •{' '}
                      {proj.originalItems.length} item awal • {proj.requestedItems.length}{' '}
                      permintaan baru
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <label className="sr-only" htmlFor={`admin-status-${proj.id}`}>
                      Status proyek {proj.name}
                    </label>
                    <select
                      id={`admin-status-${proj.id}`}
                      value={proj.status}
                      disabled={isBusy}
                      onChange={(e) =>
                        void handleStatusChange(proj.id, e.target.value as ProjectStatus)
                      }
                      className="rounded-full border border-borderSoft bg-white px-3 py-1.5 text-xs font-bold text-ink min-h-[36px]"
                    >
                      <option value="active">Aktif</option>
                      <option value="draft">Draf</option>
                      <option value="completed">Selesai</option>
                      <option value="archived">Arsip</option>
                    </select>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void onOpenProjectInStudio(proj.id)}
                      className="inline-flex items-center gap-1 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-violetDeep shadow-sm hover:bg-lavenderTint studio-transition min-h-[36px]"
                    >
                      <span>Buka di Studio</span>
                      <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleDelete(proj.id)}
                      aria-label={`Hapus proyek ${proj.name}`}
                      className="inline-flex items-center justify-center rounded-full bg-white p-2 text-inkMuted hover:bg-rose-50 hover:text-rose-700 shadow-sm min-h-[36px] min-w-[36px]"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
