import type { Project, WorkItem } from '../types';

export interface ValidationIssue {
  field: string;
  message: string;
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    !Number.isNaN(dt.getTime()) &&
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function assertNonNegativeFinite(value: number, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} harus berupa angka valid bernilai 0 atau lebih.`);
  }
  return value;
}

export function assertPositiveFinite(value: number, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${fieldName} harus lebih besar dari 0.`);
  }
  return value;
}

export function validateWorkItem(item: Partial<WorkItem>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!item.name || item.name.trim().length === 0) {
    issues.push({ field: 'name', message: 'Nama pekerjaan wajib diisi.' });
  }
  if (
    item.estimatedHours === undefined ||
    !Number.isFinite(item.estimatedHours) ||
    item.estimatedHours < 0
  ) {
    issues.push({
      field: 'estimatedHours',
      message: 'Estimasi jam tidak boleh negatif atau kosong.',
    });
  }
  if (
    item.quantity === undefined ||
    !Number.isInteger(item.quantity) ||
    item.quantity < 1
  ) {
    issues.push({
      field: 'quantity',
      message: 'Kuantitas minimal 1 unit.',
    });
  }
  if (
    item.revisionLimit === undefined ||
    !Number.isInteger(item.revisionLimit) ||
    item.revisionLimit < 0
  ) {
    issues.push({
      field: 'revisionLimit',
      message: 'Batas revisi tidak boleh negatif.',
    });
  }

  return issues;
}

export function validateProject(project: Partial<Project>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!project.name || project.name.trim().length === 0) {
    issues.push({ field: 'name', message: 'Nama proyek wajib diisi.' });
  }
  if (!project.clientName || project.clientName.trim().length === 0) {
    issues.push({ field: 'clientName', message: 'Nama klien wajib diisi.' });
  }
  if (
    project.initialPrice === undefined ||
    !Number.isFinite(project.initialPrice) ||
    project.initialPrice < 0
  ) {
    issues.push({
      field: 'initialPrice',
      message: 'Harga awal tidak boleh negatif.',
    });
  }
  if (
    project.hourlyRate === undefined ||
    !Number.isFinite(project.hourlyRate) ||
    project.hourlyRate <= 0
  ) {
    issues.push({
      field: 'hourlyRate',
      message: 'Tarif per jam harus lebih besar dari Rp0.',
    });
  }
  if (
    project.productiveHoursPerDay === undefined ||
    !Number.isFinite(project.productiveHoursPerDay) ||
    project.productiveHoursPerDay <= 0 ||
    project.productiveHoursPerDay > 24
  ) {
    issues.push({
      field: 'productiveHoursPerDay',
      message: 'Jam produktif per hari harus di antara 0,5 hingga 24 jam.',
    });
  }
  if (!project.startDate || !isValidIsoDate(project.startDate)) {
    issues.push({ field: 'startDate', message: 'Tanggal mulai tidak valid.' });
  }
  if (!project.initialDeadline || !isValidIsoDate(project.initialDeadline)) {
    issues.push({ field: 'initialDeadline', message: 'Deadline awal tidak valid.' });
  }
  if (
    project.startDate &&
    project.initialDeadline &&
    isValidIsoDate(project.startDate) &&
    isValidIsoDate(project.initialDeadline) &&
    project.initialDeadline < project.startDate
  ) {
    issues.push({
      field: 'initialDeadline',
      message: 'Deadline awal tidak boleh lebih awal dari tanggal mulai.',
    });
  }
  if (!project.workingDays || project.workingDays.length === 0) {
    issues.push({
      field: 'workingDays',
      message: 'Pilih minimal 1 hari kerja dalam seminggu.',
    });
  }

  return issues;
}
