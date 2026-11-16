import type { ItemStatus, NegotiationStrategy } from '../types';

export function formatRupiah(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  const absFormatted = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(safe));
  return safe < 0 ? `-Rp${absFormatted}` : `Rp${absFormatted}`;
}

/**
 * Format ringkas untuk kartu metrik & ringkasan cepat:
 * contoh: 900_000 -> "Rp 900rb", 2_400_000 -> "Rp 2,4jt", 0 -> "Rp 0"
 */
export function formatCompactRupiah(amount: number, showPlus = false): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  if (safe === 0) return 'Rp 0';

  const prefix = safe < 0 ? '-Rp ' : showPlus ? '+Rp ' : 'Rp ';
  const abs = Math.abs(safe);

  if (abs >= 1_000_000) {
    const millions = Math.round((abs / 1_000_000) * 100) / 100;
    const formatted = new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(millions);
    return `${prefix}${formatted}jt`;
  }

  if (abs >= 1_000) {
    const thousands = Math.round((abs / 1_000) * 10) / 10;
    const formatted = new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(thousands);
    return `${prefix}${formatted}rb`;
  }

  return `${prefix}${abs}`;
}

export function formatHours(hours: number): string {
  const safe = Number.isFinite(hours) ? hours : 0;
  const rounded = Math.round(safe * 100) / 100;
  return `${new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 2,
  }).format(rounded)} jam`;
}

export function formatCompactHours(hours: number): string {
  const safe = Number.isFinite(hours) ? hours : 0;
  const rounded = Math.round(safe * 100) / 100;
  return `${new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 2,
  }).format(rounded)}j`;
}

export function formatIndonesianDate(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || '-';
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatShortDate(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || '-';
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export const STATUS_BADGE_MAP: Record<
  ItemStatus,
  { label: string; bg: string; text: string; border: string; description: string }
> = {
  unchanged: {
    label: 'Sesuai Awal',
    bg: '#ECFDF5',
    text: '#047857',
    border: '#A7F3D0',
    description: 'Sesuai kesepakatan awal',
  },
  added: {
    label: 'Permintaan Baru',
    bg: '#FFF1F2',
    text: '#BE123C',
    border: '#FECDD3',
    description: 'Pekerjaan baru di luar kontrak awal',
  },
  modified: {
    label: 'Diubah',
    bg: '#FFFBEB',
    text: '#B45309',
    border: '#FDE68A',
    description: 'Perubahan jam, jumlah, atau revisi dari item awal',
  },
  removed: {
    label: 'Dihapus',
    bg: '#FEF2F2',
    text: '#991B1B',
    border: '#FECACA',
    description: 'Dikeluarkan dari lingkup pengerjaan',
  },
  swapped: {
    label: 'Ditukar',
    bg: '#F1F5F9',
    text: '#475569',
    border: '#CBD5E1',
    description: 'Ditukar dengan fitur baru pada mode Tukar Fitur',
  },
  deferred: {
    label: 'Fase 2',
    bg: '#F3EEFF',
    text: '#6D28D9',
    border: '#DDD6FE',
    description: 'Ditunda ke kontrak fase berikutnya',
  },
};

export const STRATEGY_META: Record<
  NegotiationStrategy,
  { label: string; shortLabel: string; hint: string }
> = {
  accept_changes: {
    label: 'Terima & Sesuaikan Biaya',
    shortLabel: 'Terima & Sesuaikan Biaya',
    hint: 'Semua permintaan dikerjakan sekarang dengan penyesuaian biaya dan tenggat waktu.',
  },
  scope_swap: {
    label: 'Tukar Fitur (Scope Swap)',
    shortLabel: 'Tukar Fitur',
    hint: 'Tukar fitur awal dengan permintaan baru agar anggaran dan tenggat waktu tetap terjaga.',
  },
  phase_2: {
    label: 'Pindahkan ke Fase 2',
    shortLabel: 'Pindahkan ke Fase 2',
    hint: 'Harga & jadwal Fase 1 tetap aman, tambahan fitur masuk ke kontrak Fase 2.',
  },
};
