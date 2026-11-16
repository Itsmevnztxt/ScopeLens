import { analyzeProjectScope } from '../engine/scopeAnalyzer';
import { sanitizeText } from '../lib/sanitize';
import { getSupabaseClient } from '../lib/supabase';
import { validateWorkItem } from '../lib/validation';
import type { Project, ScopeAnalysisResult, WorkItem } from '../types';
import { toSafeErrorMessage } from './authService';

export async function createScopeItem(
  projectId: string,
  item: Omit<WorkItem, 'id' | 'projectId'>
): Promise<WorkItem> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Backend Supabase belum dikonfigurasi.');

  const issues = validateWorkItem(item);
  if (issues.length > 0) throw new Error(issues[0].message);

  // Aturan integritas: original item tidak boleh merujuk ke item lain
  const safeOriginalRef =
    item.itemType === 'original' ? null : item.originalItemId;

  const { data, error } = await supabase
    .from('scope_items')
    .insert({
      project_id: projectId,
      original_item_id: safeOriginalRef,
      item_name: sanitizeText(item.name, 160),
      description: sanitizeText(item.description, 1000),
      quantity: item.quantity,
      estimated_hours: item.estimatedHours,
      revision_limit: item.revisionLimit,
      priority: item.priority,
      category: sanitizeText(item.category, 80) || 'Feature',
      item_type: item.itemType,
      status: item.status,
      sort_order: item.sortOrder ?? 0,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(toSafeErrorMessage(error, 'Gagal menambahkan item pekerjaan.'));
  }

  return {
    id: data.id,
    projectId: data.project_id,
    originalItemId: data.original_item_id,
    name: data.item_name,
    description: data.description,
    quantity: Number(data.quantity),
    estimatedHours: Number(data.estimated_hours),
    revisionLimit: Number(data.revision_limit),
    priority: data.priority,
    category: data.category,
    itemType: data.item_type,
    status: data.status,
    sortOrder: data.sort_order,
  };
}

export async function updateScopeItem(
  itemId: string,
  patch: Partial<WorkItem>
): Promise<WorkItem> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Backend Supabase belum dikonfigurasi.');

  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.item_name = sanitizeText(patch.name, 160);
  if (patch.description !== undefined) payload.description = sanitizeText(patch.description, 1000);
  if (patch.quantity !== undefined) payload.quantity = patch.quantity;
  if (patch.estimatedHours !== undefined) payload.estimated_hours = patch.estimatedHours;
  if (patch.revisionLimit !== undefined) payload.revision_limit = patch.revisionLimit;
  if (patch.priority !== undefined) payload.priority = patch.priority;
  if (patch.category !== undefined) payload.category = sanitizeText(patch.category, 80);
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.originalItemId !== undefined) payload.original_item_id = patch.originalItemId;
  if (patch.sortOrder !== undefined) payload.sort_order = patch.sortOrder;

  const { data, error } = await supabase
    .from('scope_items')
    .update(payload)
    .eq('id', itemId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(toSafeErrorMessage(error, 'Gagal memperbarui item pekerjaan.'));
  }

  return {
    id: data.id,
    projectId: data.project_id,
    originalItemId: data.original_item_id,
    name: data.item_name,
    description: data.description,
    quantity: Number(data.quantity),
    estimatedHours: Number(data.estimated_hours),
    revisionLimit: Number(data.revision_limit),
    priority: data.priority,
    category: data.category,
    itemType: data.item_type,
    status: data.status,
    sortOrder: data.sort_order,
  };
}

export async function deleteScopeItem(itemId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Backend Supabase belum dikonfigurasi.');

  const { error } = await supabase.from('scope_items').delete().eq('id', itemId);
  if (error) {
    throw new Error(toSafeErrorMessage(error, 'Gagal menghapus item pekerjaan.'));
  }
}

export async function getOriginalScope(projectId: string): Promise<WorkItem[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('scope_items')
    .select('*')
    .eq('project_id', projectId)
    .eq('item_type', 'original')
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(toSafeErrorMessage(error, 'Gagal mengambil ruang lingkup awal.'));
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    originalItemId: row.original_item_id,
    name: row.item_name,
    description: row.description,
    quantity: Number(row.quantity),
    estimatedHours: Number(row.estimated_hours),
    revisionLimit: Number(row.revision_limit),
    priority: row.priority,
    category: row.category,
    itemType: 'original',
    status: row.status,
    sortOrder: row.sort_order,
  }));
}

export async function getRequestedScope(projectId: string): Promise<WorkItem[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('scope_items')
    .select('*')
    .eq('project_id', projectId)
    .eq('item_type', 'requested')
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(toSafeErrorMessage(error, 'Gagal mengambil daftar permintaan klien.'));
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    originalItemId: row.original_item_id,
    name: row.item_name,
    description: row.description,
    quantity: Number(row.quantity),
    estimatedHours: Number(row.estimated_hours),
    revisionLimit: Number(row.revision_limit),
    priority: row.priority,
    category: row.category,
    itemType: 'requested',
    status: row.status,
    sortOrder: row.sort_order,
  }));
}

export function compareScope(project: Project): ScopeAnalysisResult {
  return analyzeProjectScope(project);
}
