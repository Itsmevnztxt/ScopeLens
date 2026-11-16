import { getSupabaseClient } from '../lib/supabase';
import { sanitizeText } from '../lib/sanitize';
import { validateProject } from '../lib/validation';
import { simulateNegotiation } from '../engine/negotiationEngine';
import type {
  NegotiationStrategy,
  Project,
  ProjectStatus,
  WorkItem,
} from '../types';
import { toSafeErrorMessage } from './authService';

interface DbProjectRow {
  id: string;
  user_id: string;
  project_name: string;
  client_name: string;
  project_category: string;
  project_description: string;
  start_date: string;
  original_deadline: string;
  initial_price: number;
  hourly_rate: number;
  productive_hours_per_day: number;
  work_days: number[];
  holidays: string[] | null;
  currency: 'IDR';
  status: ProjectStatus;
  updated_at: string;
}

interface DbScopeItemRow {
  id: string;
  project_id: string;
  original_item_id: string | null;
  item_name: string;
  description: string;
  quantity: number;
  estimated_hours: number;
  revision_limit: number;
  priority: 'high' | 'medium' | 'low';
  category: string;
  item_type: 'original' | 'requested';
  status: WorkItem['status'];
  sort_order: number;
}

function mapScopeRow(row: DbScopeItemRow): WorkItem {
  return {
    id: row.id,
    projectId: row.project_id,
    originalItemId: row.original_item_id,
    name: row.item_name,
    description: row.description ?? '',
    quantity: Number(row.quantity) || 1,
    estimatedHours: Number(row.estimated_hours) || 0,
    revisionLimit: Number(row.revision_limit) || 0,
    priority: row.priority ?? 'medium',
    category: row.category ?? 'Feature',
    itemType: row.item_type,
    status: row.status,
    sortOrder: row.sort_order ?? 0,
  };
}

function mapProjectRow(
  row: DbProjectRow,
  items: DbScopeItemRow[],
  activeStrategy: NegotiationStrategy = 'accept_changes',
  swappedOutItemIds: string[] = [],
  deferredRequestIds: string[] = [],
  excludedRequestIds: string[] = [],
  negotiationNotes = ''
): Project {
  const mappedItems = items.map(mapScopeRow);
  return {
    id: row.id,
    userId: row.user_id,
    name: row.project_name,
    clientName: row.client_name,
    category: row.project_category,
    description: row.project_description ?? '',
    startDate: row.start_date,
    initialDeadline: row.original_deadline,
    initialPrice: Number(row.initial_price),
    hourlyRate: Number(row.hourly_rate),
    productiveHoursPerDay: Number(row.productive_hours_per_day),
    workingDays: row.work_days ?? [1, 2, 3, 4, 5],
    holidays: row.holidays ?? [],
    currency: 'IDR',
    status: row.status,
    originalItems: mappedItems.filter((i) => i.itemType === 'original'),
    requestedItems: mappedItems.filter((i) => i.itemType === 'requested'),
    negotiationStrategy: activeStrategy,
    swappedOutItemIds,
    deferredRequestIds,
    excludedRequestIds,
    negotiationNotes,
    updatedAt: row.updated_at,
  };
}

function sanitizeProjectInput(project: Project): Project {
  return {
    ...project,
    name: sanitizeText(project.name, 160),
    clientName: sanitizeText(project.clientName, 140),
    category: sanitizeText(project.category, 80) || 'Web Development',
    description: sanitizeText(project.description, 1500),
    initialPrice: Math.round(project.initialPrice),
    hourlyRate: Math.round(project.hourlyRate),
    originalItems: project.originalItems.map((i, idx) => ({
      ...i,
      name: sanitizeText(i.name, 160),
      description: sanitizeText(i.description, 1000),
      category: sanitizeText(i.category, 80) || 'Feature',
      itemType: 'original',
      originalItemId: null,
      sortOrder: idx + 1,
    })),
    requestedItems: project.requestedItems.map((i, idx) => ({
      ...i,
      name: sanitizeText(i.name, 160),
      description: sanitizeText(i.description, 1000),
      category: sanitizeText(i.category, 80) || 'Feature',
      itemType: 'requested',
      sortOrder: idx + 1,
    })),
  };
}

export async function createProject(
  input: Omit<Project, 'id' | 'originalItems' | 'requestedItems'> & {
    originalItems?: WorkItem[];
    requestedItems?: WorkItem[];
  }
): Promise<Project> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Backend Supabase belum dikonfigurasi.');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Silakan masuk terlebih dahulu untuk membuat proyek.');

  const issues = validateProject(input);
  if (issues.length > 0) {
    throw new Error(issues[0].message);
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      project_name: sanitizeText(input.name, 160),
      client_name: sanitizeText(input.clientName, 140),
      project_category: sanitizeText(input.category, 80) || 'Web Development',
      project_description: sanitizeText(input.description, 1500),
      start_date: input.startDate,
      original_deadline: input.initialDeadline,
      initial_price: Math.round(input.initialPrice),
      hourly_rate: Math.round(input.hourlyRate),
      productive_hours_per_day: input.productiveHoursPerDay,
      work_days: input.workingDays,
      holidays: input.holidays ?? [],
      currency: 'IDR',
      status: input.status ?? 'active',
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(toSafeErrorMessage(error, 'Gagal membuat proyek baru.'));
  }

  return mapProjectRow(data as DbProjectRow, []);
}

export async function getProjects(options?: {
  page?: number;
  pageSize?: number;
  userId?: string;
}): Promise<{ projects: Project[]; total: number }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { projects: [], total: 0 };

  let targetUserId = options?.userId;
  if (!targetUserId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    targetUserId = user?.id;
  }

  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options?.pageSize ?? 20));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('projects')
    .select('*', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (targetUserId) {
    query = query.eq('user_id', targetUserId);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(toSafeErrorMessage(error, 'Gagal memuat daftar proyek.'));
  }

  const rows = (data ?? []) as DbProjectRow[];
  if (rows.length === 0) return { projects: [], total: count ?? 0 };

  const projectIds = rows.map((r) => r.id);
  const { data: itemRows } = await supabase
    .from('scope_items')
    .select('*')
    .in('project_id', projectIds)
    .order('sort_order', { ascending: true });

  const grouped = new Map<string, DbScopeItemRow[]>();
  for (const item of (itemRows ?? []) as DbScopeItemRow[]) {
    const arr = grouped.get(item.project_id) ?? [];
    arr.push(item);
    grouped.set(item.project_id, arr);
  }

  return {
    projects: rows.map((row) => mapProjectRow(row, grouped.get(row.id) ?? [])),
    total: count ?? rows.length,
  };
}

export async function getProjectById(projectId: string): Promise<Project> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Backend Supabase belum dikonfigurasi.');

  const { data: projectRow, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (error || !projectRow) {
    throw new Error(toSafeErrorMessage(error, 'Proyek tidak ditemukan.'));
  }

  const [{ data: itemRows }, { data: negRow }] = await Promise.all([
    supabase
      .from('scope_items')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('negotiations')
      .select('id, strategy, negotiation_notes, negotiation_items(scope_item_id, action)')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let strategy: NegotiationStrategy = 'accept_changes';
  let negotiationNotes = '';
  const swappedIds: string[] = [];
  const excludedIds: string[] = [];

  if (negRow) {
    strategy = negRow.strategy as NegotiationStrategy;
    negotiationNotes = typeof negRow.negotiation_notes === 'string' ? negRow.negotiation_notes : '';
    const negItems = (negRow.negotiation_items ?? []) as Array<{
      scope_item_id: string;
      action: string;
    }>;
    for (const ni of negItems) {
      if (ni.action === 'swap') swappedIds.push(ni.scope_item_id);
      if (ni.action === 'exclude') excludedIds.push(ni.scope_item_id);
    }
  }

  // Ambil daftar item yang memang ditunda secara eksplisit pada scope_items,
  // bukan dari simulasi otomatis mode Phase 2 agar tidak terkunci saat ganti strategi.
  const deferredIds = ((itemRows ?? []) as DbScopeItemRow[])
    .filter((item) => item.item_type === 'requested' && item.status === 'deferred')
    .map((item) => item.id);

  return mapProjectRow(
    projectRow as DbProjectRow,
    (itemRows ?? []) as DbScopeItemRow[],
    strategy,
    swappedIds,
    deferredIds,
    excludedIds,
    negotiationNotes
  );
}

export async function updateProject(
  projectId: string,
  patch: Partial<Project>
): Promise<Project> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Backend Supabase belum dikonfigurasi.');

  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.project_name = sanitizeText(patch.name, 160);
  if (patch.clientName !== undefined) payload.client_name = sanitizeText(patch.clientName, 140);
  if (patch.category !== undefined) payload.project_category = sanitizeText(patch.category, 80);
  if (patch.description !== undefined) payload.project_description = sanitizeText(patch.description, 1500);
  if (patch.startDate !== undefined) payload.start_date = patch.startDate;
  if (patch.initialDeadline !== undefined) payload.original_deadline = patch.initialDeadline;
  if (patch.initialPrice !== undefined) payload.initial_price = Math.round(patch.initialPrice);
  if (patch.hourlyRate !== undefined) payload.hourly_rate = Math.round(patch.hourlyRate);
  if (patch.productiveHoursPerDay !== undefined) payload.productive_hours_per_day = patch.productiveHoursPerDay;
  if (patch.workingDays !== undefined) payload.work_days = patch.workingDays;
  if (patch.holidays !== undefined) payload.holidays = patch.holidays;
  if (patch.status !== undefined) payload.status = patch.status;

  const { error } = await supabase.from('projects').update(payload).eq('id', projectId);
  if (error) {
    throw new Error(toSafeErrorMessage(error, 'Gagal memperbarui detail proyek.'));
  }

  return getProjectById(projectId);
}

export async function deleteProject(projectId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Backend Supabase belum dikonfigurasi.');

  const { error } = await supabase.from('projects').delete().eq('id', projectId);
  if (error) {
    throw new Error(toSafeErrorMessage(error, 'Gagal menghapus proyek.'));
  }
}

/**
 * Menyimpan seluruh proyek, scope_items (original & requested), dan negosiasi aktif
 * secara atomik melalui PostgreSQL RPC `save_project_workspace`.
 */
export async function saveProjectWorkspace(project: Project): Promise<Project> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Backend Supabase belum dikonfigurasi.');

  const clean = sanitizeProjectInput(project);
  const issues = validateProject(clean);
  if (issues.length > 0) {
    throw new Error(issues[0].message);
  }

  // Pastikan setiap ID adalah UUID valid sebelum dikirim ke PostgreSQL UUID column
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const idMap = new Map<string, string>();
  const ensureUuid = (id: string) => {
    if (uuidRegex.test(id)) return id;
    if (!idMap.has(id)) idMap.set(id, crypto.randomUUID());
    return idMap.get(id)!;
  };

  const normalizedOriginal = clean.originalItems.map((item, idx) => ({
    id: ensureUuid(item.id),
    original_item_id: null,
    item_name: item.name,
    description: item.description,
    quantity: item.quantity,
    estimated_hours: item.estimatedHours,
    revision_limit: item.revisionLimit,
    priority: item.priority,
    category: item.category,
    item_type: 'original',
    status: item.status,
    sort_order: idx + 1,
  }));

  const deferredIdSet = new Set(clean.deferredRequestIds);
  const normalizedRequested = clean.requestedItems.map((item, idx) => ({
    id: ensureUuid(item.id),
    original_item_id: item.originalItemId ? ensureUuid(item.originalItemId) : null,
    item_name: item.name,
    description: item.description,
    quantity: item.quantity,
    estimated_hours: item.estimatedHours,
    revision_limit: item.revisionLimit,
    priority: item.priority,
    category: item.category,
    item_type: 'requested',
    status: deferredIdSet.has(item.id) ? 'deferred' : item.status,
    sort_order: idx + 1,
  }));

  const sim = simulateNegotiation(clean);

  const pProject = {
    id: uuidRegex.test(clean.id) ? clean.id : null,
    project_name: clean.name,
    client_name: clean.clientName,
    project_category: clean.category,
    project_description: clean.description,
    start_date: clean.startDate,
    original_deadline: clean.initialDeadline,
    initial_price: clean.initialPrice,
    hourly_rate: clean.hourlyRate,
    productive_hours_per_day: clean.productiveHoursPerDay,
    work_days: clean.workingDays,
    holidays: clean.holidays,
    currency: 'IDR',
    status: clean.status,
  };

  const pNegotiation = {
    strategy: sim.active.strategy,
    additional_cost: sim.active.additionalCostNow,
    additional_hours: sim.active.additionalHoursNow,
    revised_price: sim.active.revisedPrice,
    revised_deadline: sim.active.revisedDeadline,
    negotiation_notes: sanitizeText(clean.negotiationNotes ?? '', 2000),
    items: sim.active.itemActions.map((ia) => ({
      scope_item_id: ensureUuid(ia.scopeItemId),
      action: ia.action,
    })),
  };

  const { data: savedId, error } = await supabase.rpc('save_project_workspace', {
    p_project: pProject,
    p_scope_items: [...normalizedOriginal, ...normalizedRequested],
    p_negotiation: pNegotiation,
  });

  if (error || !savedId) {
    throw new Error(toSafeErrorMessage(error, 'Gagal menyimpan perubahan proyek ke server.'));
  }

  return getProjectById(String(savedId));
}
