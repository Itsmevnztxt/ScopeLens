import type { DeadlineCalculationResult } from '../types';
import { assertPositiveFinite, isValidIsoDate } from '../lib/validation';

function parseUtcDate(isoDate: string): Date {
  if (!isValidIsoDate(isoDate)) {
    throw new Error(`Format tanggal tidak valid: "${isoDate}". Gunakan YYYY-MM-DD.`);
  }
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Mengembalikan ISO weekday 1 (Senin) .. 7 (Minggu).
 * Mendukung input konvensi 0 (Minggu) menjadi 7 agar kompatibel.
 */
function normalizeWorkingDays(workingDays: number[]): Set<number> {
  const normalized = new Set<number>();
  for (const day of workingDays) {
    if (day === 0) {
      normalized.add(7);
    } else if (day >= 1 && day <= 7) {
      normalized.add(day);
    }
  }
  return normalized;
}

function isWorkingDay(
  date: Date,
  workingDaySet: Set<number>,
  holidaySet: Set<string>
): boolean {
  const isoDay = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  if (!workingDaySet.has(isoDay)) return false;
  if (holidaySet.has(toIsoDate(date))) return false;
  return true;
}

/**
 * Menambahkan N hari kerja setelah tanggal referensi dengan memperhitungkan
 * hari kerja aktif, akhir pekan, dan daftar hari libur.
 */
export function addWorkingDays(
  fromIsoDate: string,
  workingDaysToAdd: number,
  workingDays: number[] = [1, 2, 3, 4, 5],
  holidays: string[] = []
): { targetDate: string; calendarDaysAdded: number } {
  const start = parseUtcDate(fromIsoDate);
  const count = Math.max(0, Math.floor(workingDaysToAdd));
  if (count === 0) {
    return { targetDate: fromIsoDate, calendarDaysAdded: 0 };
  }

  const workingDaySet = normalizeWorkingDays(workingDays);
  if (workingDaySet.size === 0) {
    throw new Error('Konfigurasi hari kerja tidak boleh kosong.');
  }

  const holidaySet = new Set(holidays.filter(isValidIsoDate));
  const cursor = new Date(start.getTime());
  let addedWorking = 0;
  let calendarDays = 0;
  const maxIterations = 36500;

  while (addedWorking < count) {
    if (calendarDays >= maxIterations) {
      throw new Error('Tidak dapat menghitung deadline karena semua hari ditandai libur.');
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    calendarDays += 1;
    if (isWorkingDay(cursor, workingDaySet, holidaySet)) {
      addedWorking += 1;
    }
  }

  return {
    targetDate: toIsoDate(cursor),
    calendarDaysAdded: calendarDays,
  };
}

export interface DeadlineCalculatorInput {
  startDate: string;
  originalDeadline: string;
  originalHours: number;
  additionalHours: number;
  productiveHoursPerDay: number;
  workingDays: number[];
  holidays?: string[];
}

export function calculateDeadlineImpact(
  input: DeadlineCalculatorInput
): DeadlineCalculationResult {
  const start = parseUtcDate(input.startDate);
  const origEnd = parseUtcDate(input.originalDeadline);
  if (origEnd.getTime() < start.getTime()) {
    throw new Error('Deadline awal tidak boleh lebih awal daripada tanggal mulai.');
  }

  const productiveHoursPerDay = assertPositiveFinite(
    input.productiveHoursPerDay,
    'Jam kerja produktif per hari'
  );

  const safeAdditionalHours = Number.isFinite(input.additionalHours)
    ? input.additionalHours
    : 0;
  const safeOriginalHours = Number.isFinite(input.originalHours)
    ? Math.max(0, input.originalHours)
    : 0;

  const additionalWorkingDays =
    safeAdditionalHours > 0
      ? Math.ceil(safeAdditionalHours / productiveHoursPerDay)
      : 0;

  const { targetDate, calendarDaysAdded } = addWorkingDays(
    input.originalDeadline,
    additionalWorkingDays,
    input.workingDays,
    input.holidays ?? []
  );

  const totalEstimatedHours = Math.max(0, safeOriginalHours + safeAdditionalHours);
  const totalEstimatedWorkingDays =
    totalEstimatedHours > 0
      ? Math.ceil(totalEstimatedHours / productiveHoursPerDay)
      : 0;

  return {
    startDate: input.startDate,
    originalDeadline: input.originalDeadline,
    additionalHours: safeAdditionalHours,
    productiveHoursPerDay,
    additionalWorkingDays,
    calendarDaysAdded,
    revisedDeadline: targetDate,
    totalEstimatedHours,
    totalEstimatedWorkingDays,
  };
}
