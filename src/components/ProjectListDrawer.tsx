import React, { useEffect, useId, useState } from 'react';
import { CopyPlus, FolderPlus, RotateCcw, Trash2, X } from 'lucide-react';
import { formatRupiah } from '../lib/formatters';
import type { Project, UserProfile } from '../types';
import { NativeDialog } from './NativeDialog';

interface ProjectListDrawerProps {
  open: boolean;
  initialShowNewForm?: boolean;
  activeProjectId: string;
  user: UserProfile | null;
  supabaseReady: boolean;
  cloudProjects: Project[];
  onClose: () => void;
  onLoadSampleCase: () => void;
  onCreateSampleCloudProject: () => Promise<boolean>;
  onSelectCloudProject: (projectId: string) => void;
  onCreateProject: (input: {
    name: string;
    clientName: string;
    category: string;
    initialPrice: number;
    hourlyRate: number;
    productiveHoursPerDay: number;
    startDate: string;
    initialDeadline: string;
  }) => Promise<void>;
  onDeleteCloudProject: (projectId: string) => Promise<void>;
}

export const ProjectListDrawer: React.FC<ProjectListDrawerProps> = ({
  open,
  initialShowNewForm = false,
  activeProjectId,
  user,
  supabaseReady,
  cloudProjects,
  onClose,
  onLoadSampleCase,
  onCreateSampleCloudProject,
  onSelectCloudProject,
  onCreateProject,
  onDeleteCloudProject,
}) => {
  const titleId = useId();
  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const [showNewForm, setShowNewForm] = useState(initialShowNewForm);
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [initialPrice, setInitialPrice] = useState('2500000');
  const [hourlyRate, setHourlyRate] = useState('100000');
  const [startDate, setStartDate] = useState(today);
  const [initialDeadline, setInitialDeadline] = useState(nextWeek);
  const [creating, setCreating] = useState(false);
  const [seedingSample, setSeedingSample] = useState(false);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    if (open) {
      setShowNewForm(initialShowNewForm);
      setErrorText('');
    } else {
      setShowNewForm(false);
      setErrorText('');
    }
  }, [open, initialShowNewForm]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');
    if (!name.trim() || !clientName.trim()) {
      setErrorText('Nama proyek dan nama klien wajib diisi.');
      return;
    }
    const parsedPrice = Number(initialPrice);
    const parsedRate = Number(hourlyRate);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setErrorText('Harga awal tidak boleh negatif.');
      return;
    }
    if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
      setErrorText('Tarif per jam harus lebih besar dari Rp0.');
      return;
    }
    if (!startDate || !initialDeadline || initialDeadline < startDate) {
      setErrorText('Deadline awal tidak boleh lebih awal dari tanggal mulai.');
      return;
    }

    setCreating(true);
    try {
      await onCreateProject({
        name: name.trim(),
        clientName: clientName.trim(),
        category: 'Web Development',
        initialPrice: Math.round(parsedPrice),
        hourlyRate: Math.round(parsedRate),
        productiveHoursPerDay: 6,
        startDate,
        initialDeadline,
      });
      setName('');
      setClientName('');
      setShowNewForm(false);
      onClose();
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Gagal membuat proyek baru.');
    } finally {
      setCreating(false);
    }
  };

  const handleCopySampleToAccount = async () => {
    setErrorText('');
    setSeedingSample(true);
    try {
      const ok = await onCreateSampleCloudProject();
      if (ok) {
        onClose();
      } else {
        setErrorText('Gagal menyalin contoh proyek ke akun Anda. Silakan coba lagi.');
      }
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Gagal menyalin contoh proyek.');
    } finally {
      setSeedingSample(false);
    }
  };

  const isCloudUser = Boolean(user && supabaseReady);

  return (
    <NativeDialog open={open} onClose={onClose} labelledBy={titleId}>
      <div className="p-6 sm:p-7 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-xl font-extrabold text-ink">
              Daftar Proyek
            </h2>
            <p className="text-xs text-inkMuted mt-1">
              {isCloudUser
                ? `Masuk sebagai ${user?.fullName || user?.email}. Seluruh proyek tersimpan di database PostgreSQL akun Anda.`
                : 'Proyek tersimpan otomatis di browser ini. Anda juga bisa membuat proyek baru kapan saja.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup daftar proyek"
            className="rounded-xl p-2 text-inkMuted hover:text-ink hover:bg-subtle min-h-[40px] min-w-[40px] inline-flex items-center justify-center"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Contoh Kasus / Template Proyek */}
        <div className="rounded-2xl bg-lavenderTint/70 p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-violetDeep">
              {isCloudUser ? 'Template Proyek Siap Pakai' : 'Contoh Kasus Siap Pakai'}
            </p>
            <p className="text-sm font-bold text-ink mt-0.5">Website Company Profile</p>
            <p className="text-xs text-inkMuted">
              Ardi Pratama (Kopi Senja Studio) • Rp1.500.000 • 20 jam awal
            </p>
          </div>
          {isCloudUser ? (
            <button
              type="button"
              disabled={seedingSample}
              onClick={() => void handleCopySampleToAccount()}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-bold text-violetDeep shadow-sm hover:bg-lavenderTint studio-transition min-h-[38px] shrink-0 disabled:opacity-60"
            >
              <CopyPlus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{seedingSample ? 'Menyimpan...' : 'Salin ke Akun Saya'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onLoadSampleCase();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-bold text-violetDeep shadow-sm hover:bg-lavenderTint studio-transition min-h-[38px] shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Muat Contoh Kasus</span>
            </button>
          )}
        </div>

        {/* Cloud Projects */}
        {user && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-inkMuted">
              Proyek Tersimpan ({cloudProjects.length})
            </h3>
            {cloudProjects.length === 0 ? (
              <p className="text-xs text-inkMuted rounded-2xl bg-canvas p-4 text-center">
                Belum ada proyek tersimpan di akun Anda.
              </p>
            ) : (
              <ul className="space-y-2 max-h-56 overflow-y-auto">
                {cloudProjects.map((cp) => (
                  <li
                    key={cp.id}
                    className={`flex items-center justify-between gap-3 rounded-2xl p-3 ${
                      cp.id === activeProjectId
                        ? 'bg-lavenderTint ring-1 ring-violetPrimary/40'
                        : 'bg-canvas'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectCloudProject(cp.id);
                        onClose();
                      }}
                      className="text-left flex-1 min-w-0"
                    >
                      <span className="block text-sm font-bold text-ink truncate">{cp.name}</span>
                      <span className="block text-xs text-inkMuted font-numeric">
                        {cp.clientName} • {formatRupiah(cp.initialPrice)}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteCloudProject(cp.id)}
                      aria-label={`Hapus proyek ${cp.name}`}
                      className="p-2 text-inkMuted hover:text-rose-700 rounded-xl hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Create New Workspace */}
        {!showNewForm ? (
          <button
            type="button"
            onClick={() => setShowNewForm(true)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-dashed border-violetPrimary/40 bg-lavenderTint/40 py-3 text-xs sm:text-sm font-bold text-violetDeep hover:bg-lavenderTint min-h-[44px]"
          >
            <FolderPlus className="w-4 h-4" aria-hidden="true" />
            <span>Buat Proyek Baru</span>
          </button>
        ) : (
          <form onSubmit={handleCreate} className="rounded-2xl bg-canvas p-4 space-y-3">
            <h3 className="text-sm font-bold text-ink">Proyek Baru</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="new-proj-name" className="block text-xs font-semibold text-ink mb-1">
                  Nama Proyek
                </label>
                <input
                  id="new-proj-name"
                  type="text"
                  required
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Aplikasi Kasir UMKM"
                  className="w-full rounded-xl border border-borderSoft bg-surface px-3 py-2 text-sm min-h-[42px]"
                />
              </div>
              <div>
                <label htmlFor="new-proj-client" className="block text-xs font-semibold text-ink mb-1">
                  Nama Klien
                </label>
                <input
                  id="new-proj-client"
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Raka Wijaya (Warung Kopi)"
                  className="w-full rounded-xl border border-borderSoft bg-surface px-3 py-2 text-sm min-h-[42px]"
                />
              </div>
              <div>
                <label htmlFor="new-proj-price" className="block text-xs font-semibold text-ink mb-1">
                  Harga Awal (Rp)
                </label>
                <input
                  id="new-proj-price"
                  type="number"
                  min={0}
                  value={initialPrice}
                  onChange={(e) => setInitialPrice(e.target.value)}
                  className="w-full rounded-xl border border-borderSoft bg-surface px-3 py-2 text-sm font-numeric min-h-[42px]"
                />
              </div>
              <div>
                <label htmlFor="new-proj-rate" className="block text-xs font-semibold text-ink mb-1">
                  Tarif / Jam (Rp)
                </label>
                <input
                  id="new-proj-rate"
                  type="number"
                  min={1000}
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  className="w-full rounded-xl border border-borderSoft bg-surface px-3 py-2 text-sm font-numeric min-h-[42px]"
                />
              </div>
              <div>
                <label htmlFor="new-proj-start" className="block text-xs font-semibold text-ink mb-1">
                  Tanggal Mulai
                </label>
                <input
                  id="new-proj-start"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-borderSoft bg-surface px-3 py-2 text-sm font-numeric min-h-[42px]"
                />
              </div>
              <div>
                <label htmlFor="new-proj-deadline" className="block text-xs font-semibold text-ink mb-1">
                  Deadline Awal
                </label>
                <input
                  id="new-proj-deadline"
                  type="date"
                  required
                  value={initialDeadline}
                  onChange={(e) => setInitialDeadline(e.target.value)}
                  className="w-full rounded-xl border border-borderSoft bg-surface px-3 py-2 text-sm font-numeric min-h-[42px]"
                />
              </div>
            </div>
            {errorText && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                {errorText}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-inkMuted"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={creating}
                className="cta-focal-gradient rounded-full px-4 py-2 text-xs font-bold text-white"
              >
                {creating ? 'Membuat...' : 'Mulai Proyek'}
              </button>
            </div>
          </form>
        )}
      </div>
    </NativeDialog>
  );
};
