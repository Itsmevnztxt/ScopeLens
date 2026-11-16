import { calculateProjectCost, calculateRupiahFromHours } from '../engine/costCalculator';
import { calculateDeadlineImpact } from '../engine/deadlineCalculator';
import { generateNegotiationMessages } from '../engine/messageGenerator';
import { simulateNegotiation } from '../engine/negotiationEngine';
import { sanitizeText } from '../lib/sanitize';
import { getSupabaseClient } from '../lib/supabase';
import type { Project, ProjectReportSnapshot } from '../types';
import { toSafeErrorMessage } from './authService';

const LOCAL_REPORTS_KEY = 'scopelens_local_reports_v2';

function readLocalReports(): ProjectReportSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_REPORTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ProjectReportSnapshot[]) : [];
  } catch {
    return [];
  }
}

function writeLocalReports(reports: ProjectReportSnapshot[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(reports.slice(0, 30)));
  } catch {
    // Abaikan quota error agar demo tetap berjalan
  }
}

export function buildReportSnapshotPayload(
  project: Project,
  title?: string,
  negotiationId: string | null = null
): Omit<ProjectReportSnapshot, 'id' | 'generatedAt'> {
  const sim = simulateNegotiation(project);
  const excludedSet = new Set(project.excludedRequestIds ?? []);
  const phase2Set = new Set(sim.active.phase2Items.map((i) => i.id));
  const swappedSet = new Set(sim.active.swappedOutItems.map((i) => i.id));

  const activeComparisons = sim.analysis.comparisons.filter(
    (c) =>
      !excludedSet.has(c.item.id) &&
      !phase2Set.has(c.item.id) &&
      !(sim.active.strategy === 'scope_swap' && c.baselineItem && swappedSet.has(c.baselineItem.id))
  );

  const breakdown = [
    ...activeComparisons.map((c) => ({
      itemId: c.item.id,
      name: c.item.name,
      status: c.detectedStatus,
      deltaHours: c.deltaHours,
      deltaCost: c.deltaCost,
    })),
    ...(sim.active.strategy === 'scope_swap'
      ? sim.active.swappedOutItems.map((orig) => ({
          itemId: `swap-${orig.id}`,
          name: `Ditukar: ${orig.name}`,
          status: 'swapped' as const,
          deltaHours: -orig.estimatedHours,
          deltaCost: calculateRupiahFromHours(-orig.estimatedHours, project.hourlyRate),
        }))
      : []),
  ];

  const cost = calculateProjectCost({
    initialPrice: project.initialPrice,
    hourlyRate: project.hourlyRate,
    breakdown,
  });
  const deadline = calculateDeadlineImpact({
    startDate: project.startDate,
    originalDeadline: project.initialDeadline,
    originalHours: sim.analysis.originalHours,
    additionalHours: sim.active.additionalHoursNow,
    productiveHoursPerDay: project.productiveHoursPerDay,
    workingDays: project.workingDays,
    holidays: project.holidays,
  });
  const messages = generateNegotiationMessages(project, sim.analysis, sim.active);

  return {
    projectId: project.id,
    negotiationId,
    reportTitle:
      sanitizeText(title ?? '', 180) ||
      `Laporan Perubahan Scope — ${project.name}`,
    reportData: {
      project: {
        id: project.id,
        name: project.name,
        clientName: project.clientName,
        category: project.category,
        startDate: project.startDate,
        initialDeadline: project.initialDeadline,
        initialPrice: project.initialPrice,
        hourlyRate: project.hourlyRate,
        productiveHoursPerDay: project.productiveHoursPerDay,
      },
      analysis: sim.analysis,
      cost,
      deadline,
      negotiation: sim.active,
      messages,
    },
  };
}

export async function createReportSnapshot(
  project: Project,
  options?: { title?: string; negotiationId?: string | null; isAuthenticated?: boolean }
): Promise<ProjectReportSnapshot> {
  const payload = buildReportSnapshotPayload(
    project,
    options?.title,
    options?.negotiationId ?? null
  );

  const supabase = getSupabaseClient();
  if (supabase && options?.isAuthenticated && !project.isDemo) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data, error } = await supabase
        .from('project_reports')
        .insert({
          project_id: project.id,
          negotiation_id: payload.negotiationId,
          user_id: user.id,
          report_title: payload.reportTitle,
          report_data: payload.reportData,
        })
        .select()
        .single();

      if (error || !data) {
        throw new Error(toSafeErrorMessage(error, 'Gagal menyimpan snapshot laporan.'));
      }

      return {
        id: data.id,
        projectId: data.project_id,
        negotiationId: data.negotiation_id,
        reportTitle: data.report_title,
        generatedAt: data.generated_at,
        reportData: data.report_data,
      };
    }
  }

  // Fallback penyimpanan lokal (arsip snapshot di localStorage)
  const snapshot: ProjectReportSnapshot = {
    id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    generatedAt: new Date().toISOString(),
    ...payload,
  };
  const existing = readLocalReports();
  writeLocalReports([snapshot, ...existing]);
  return snapshot;
}

export async function getProjectReports(
  projectId: string,
  options?: { page?: number; pageSize?: number; isAuthenticated?: boolean }
): Promise<ProjectReportSnapshot[]> {
  const supabase = getSupabaseClient();
  if (supabase && options?.isAuthenticated) {
    const page = Math.max(1, options?.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, options?.pageSize ?? 20));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from('project_reports')
      .select('*')
      .eq('project_id', projectId)
      .order('generated_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(toSafeErrorMessage(error, 'Gagal memuat riwayat laporan proyek.'));
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      projectId: row.project_id,
      negotiationId: row.negotiation_id,
      reportTitle: row.report_title,
      generatedAt: row.generated_at,
      reportData: row.report_data,
    }));
  }

  return readLocalReports().filter((r) => r.projectId === projectId);
}

export async function getReportById(
  reportId: string,
  isAuthenticated = false
): Promise<ProjectReportSnapshot | null> {
  const supabase = getSupabaseClient();
  if (supabase && isAuthenticated) {
    const { data, error } = await supabase
      .from('project_reports')
      .select('*')
      .eq('id', reportId)
      .maybeSingle();

    if (error) {
      throw new Error(toSafeErrorMessage(error, 'Laporan tidak ditemukan.'));
    }
    if (!data) return null;
    return {
      id: data.id,
      projectId: data.project_id,
      negotiationId: data.negotiation_id,
      reportTitle: data.report_title,
      generatedAt: data.generated_at,
      reportData: data.report_data,
    };
  }

  return readLocalReports().find((r) => r.id === reportId) ?? null;
}
