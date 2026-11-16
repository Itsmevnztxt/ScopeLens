import { simulateNegotiation } from '../engine/negotiationEngine';
import { sanitizeText } from '../lib/sanitize';
import { getSupabaseClient } from '../lib/supabase';
import type {
  NegotiationAction,
  NegotiationSimulationResult,
  NegotiationStrategy,
  Project,
} from '../types';
import { toSafeErrorMessage } from './authService';

export interface StoredNegotiation {
  id: string;
  projectId: string;
  userId: string;
  strategy: NegotiationStrategy;
  additionalCost: number;
  additionalHours: number;
  revisedPrice: number;
  revisedDeadline: string;
  negotiationNotes: string;
  isActive: boolean;
  createdAt: string;
  items: Array<{ scopeItemId: string; action: NegotiationAction }>;
}

export function calculateNegotiation(
  project: Project,
  strategyOverride?: NegotiationStrategy
): NegotiationSimulationResult {
  return simulateNegotiation(project, strategyOverride).active;
}

export async function createNegotiation(
  project: Project,
  notes = ''
): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Backend Supabase belum dikonfigurasi.');

  const sim = simulateNegotiation(project);

  const { data, error } = await supabase.rpc('save_negotiation_with_items', {
    p_project_id: project.id,
    p_strategy: sim.active.strategy,
    p_additional_cost: sim.active.additionalCostNow,
    p_additional_hours: sim.active.additionalHoursNow,
    p_revised_price: sim.active.revisedPrice,
    p_revised_deadline: sim.active.revisedDeadline,
    p_negotiation_notes: sanitizeText(notes, 2000),
    p_items: sim.active.itemActions.map((ia) => ({
      scope_item_id: ia.scopeItemId,
      action: ia.action,
    })),
  });

  if (error || !data) {
    throw new Error(toSafeErrorMessage(error, 'Gagal menyimpan simulasi negosiasi.'));
  }

  return String(data);
}

export async function getNegotiations(projectId: string): Promise<StoredNegotiation[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('negotiations')
    .select('*, negotiation_items(scope_item_id, action)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(toSafeErrorMessage(error, 'Gagal memuat riwayat negosiasi.'));
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    strategy: row.strategy,
    additionalCost: Number(row.additional_cost),
    additionalHours: Number(row.additional_hours),
    revisedPrice: Number(row.revised_price),
    revisedDeadline: row.revised_deadline,
    negotiationNotes: row.negotiation_notes ?? '',
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    items: ((row.negotiation_items ?? []) as Array<{ scope_item_id: string; action: NegotiationAction }>).map(
      (ni) => ({
        scopeItemId: ni.scope_item_id,
        action: ni.action,
      })
    ),
  }));
}

export async function getNegotiationById(negotiationId: string): Promise<StoredNegotiation> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Backend Supabase belum dikonfigurasi.');

  const { data, error } = await supabase
    .from('negotiations')
    .select('*, negotiation_items(scope_item_id, action)')
    .eq('id', negotiationId)
    .single();

  if (error || !data) {
    throw new Error(toSafeErrorMessage(error, 'Data negosiasi tidak ditemukan.'));
  }

  return {
    id: data.id,
    projectId: data.project_id,
    userId: data.user_id,
    strategy: data.strategy,
    additionalCost: Number(data.additional_cost),
    additionalHours: Number(data.additional_hours),
    revisedPrice: Number(data.revised_price),
    revisedDeadline: data.revised_deadline,
    negotiationNotes: data.negotiation_notes ?? '',
    isActive: Boolean(data.is_active),
    createdAt: data.created_at,
    items: ((data.negotiation_items ?? []) as Array<{ scope_item_id: string; action: NegotiationAction }>).map(
      (ni) => ({
        scopeItemId: ni.scope_item_id,
        action: ni.action,
      })
    ),
  };
}

export async function updateNegotiation(
  negotiationId: string,
  patch: Partial<Pick<StoredNegotiation, 'negotiationNotes' | 'isActive'>>
): Promise<StoredNegotiation> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Backend Supabase belum dikonfigurasi.');

  const payload: Record<string, unknown> = {};
  if (patch.negotiationNotes !== undefined) {
    payload.negotiation_notes = sanitizeText(patch.negotiationNotes, 2000);
  }
  if (patch.isActive !== undefined) {
    payload.is_active = patch.isActive;
  }

  const { error } = await supabase
    .from('negotiations')
    .update(payload)
    .eq('id', negotiationId);

  if (error) {
    throw new Error(toSafeErrorMessage(error, 'Gagal memperbarui negosiasi.'));
  }

  return getNegotiationById(negotiationId);
}

export async function deleteNegotiation(negotiationId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Backend Supabase belum dikonfigurasi.');

  const { error } = await supabase.from('negotiations').delete().eq('id', negotiationId);
  if (error) {
    throw new Error(toSafeErrorMessage(error, 'Gagal menghapus negosiasi.'));
  }
}
