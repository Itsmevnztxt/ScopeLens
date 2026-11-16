import type { CostBreakdownItem, CostCalculationResult } from '../types';
import { assertNonNegativeFinite, assertPositiveFinite } from '../lib/validation';

/**
 * Mengonversi jam (NUMERIC) ke nominal Rupiah integer tanpa floating-point drift.
 * Menggunakan presisi milli-hours (1/1000 jam) dalam operasi integer.
 */
export function calculateRupiahFromHours(hours: number, hourlyRate: number): number {
  if (typeof hours !== 'number' || !Number.isFinite(hours)) {
    throw new Error('Jam pengerjaan harus berupa angka valid.');
  }
  assertPositiveFinite(hourlyRate, 'Tarif per jam');

  const safeRate = Math.round(hourlyRate);
  const milliHours = Math.round(hours * 1000);
  return Math.round((milliHours * safeRate) / 1000);
}

/**
 * Menjumlahkan jam secara akurat menggunakan integer milli-hours
 * untuk mencegah artefak floating-point seperti 0.1 + 0.2 = 0.30000000000000004.
 */
export function sumHoursExact(hoursList: number[]): number {
  const totalMilli = hoursList.reduce((acc, h) => {
    if (typeof h !== 'number' || !Number.isFinite(h)) {
      throw new Error('Nilai jam harus berupa angka valid.');
    }
    return acc + Math.round(h * 1000);
  }, 0);
  return totalMilli / 1000;
}

export interface CostCalculatorInput {
  initialPrice: number;
  hourlyRate: number;
  breakdown: CostBreakdownItem[];
}

export function calculateProjectCost(input: CostCalculatorInput): CostCalculationResult {
  const initialPrice = Math.round(assertNonNegativeFinite(input.initialPrice, 'Harga awal'));
  const hourlyRate = Math.round(assertPositiveFinite(input.hourlyRate, 'Tarif per jam'));

  // Deduplikasi berdasarkan itemId agar tidak pernah terjadi double counting
  const seenIds = new Set<string>();
  const uniqueBreakdown: CostBreakdownItem[] = [];

  for (const row of input.breakdown) {
    if (seenIds.has(row.itemId)) continue;
    seenIds.add(row.itemId);
    const deltaCost = calculateRupiahFromHours(row.deltaHours, hourlyRate);
    uniqueBreakdown.push({
      ...row,
      deltaCost,
    });
  }

  const additionalHours = sumHoursExact(uniqueBreakdown.map((item) => item.deltaHours));
  const additionalCost = calculateRupiahFromHours(additionalHours, hourlyRate);
  const revisedPrice = Math.max(0, initialPrice + additionalCost);

  return {
    initialPrice,
    hourlyRate,
    additionalHours,
    additionalCost,
    revisedPrice,
    breakdown: uniqueBreakdown,
  };
}
