import { getSupabaseClient } from '../lib/supabase';
import type {
  AdminProjectSummary,
  ProjectStatus,
  UserProfile,
  UserRole,
  WorkItem,
} from '../types';
import { normalizeUserRole, toSafeErrorMessage } from './authService';

interface DbProfileRow {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
  updated_at: string;
}

interface DbScopeSummaryRow {
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

interface DbProjectAdminRow {
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

export async function getAllUsersAdmin(): Promise<UserProfile[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(toSafeErrorMessage(error, 'Gagal memuat daftar pengguna.'));
  }

  return ((data ?? []) as DbProfileRow[]).map((row) => ({
    id: row.id,
    fullName: row.full_name ?? '',
    email: row.email ?? '',
    role: normalizeUserRole(row.role),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function setUserRoleAdmin(
  targetUserId: string,
  newRole: UserRole
): Promise<UserProfile> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Backend Supabase belum dikonfigurasi.');

  if (newRole !== 'admin' && newRole !== 'user') {
    throw new Error('Role pengguna tidak valid.');
  }

  const { data, error } = await supabase.rpc('admin_set_user_role', {
    p_target_user_id: targetUserId,
    p_new_role: newRole,
  });

  if (error || !data) {
    throw new Error(toSafeErrorMessage(error, 'Gagal memperbarui role pengguna.'));
  }

  const row = data as DbProfileRow;
  return {
    id: row.id,
    fullName: row.full_name ?? '',
    email: row.email ?? '',
    role: normalizeUserRole(row.role),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAllProjectsAdmin(): Promise<AdminProjectSummary[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(toSafeErrorMessage(error, 'Gagal memuat daftar seluruh proyek.'));
  }

  const rows = (data ?? []) as DbProjectAdminRow[];
  if (rows.length === 0) return [];

  const projectIds = rows.map((r) => r.id);
  const ownerIds = Array.from(new Set(rows.map((r) => r.user_id)));

  const [{ data: itemRows }, { data: ownerRows }] = await Promise.all([
    supabase
      .from('scope_items')
      .select('*')
      .in('project_id', projectIds)
      .order('sort_order', { ascending: true }),
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', ownerIds),
  ]);

  const ownerMap = new Map<string, { fullName: string; email: string }>();
  for (const owner of (ownerRows ?? []) as Array<{ id: string; full_name: string; email: string }>) {
    ownerMap.set(owner.id, {
      fullName: owner.full_name ?? '',
      email: owner.email ?? '',
    });
  }

  const itemsMap = new Map<string, WorkItem[]>();
  for (const item of (itemRows ?? []) as DbScopeSummaryRow[]) {
    const arr = itemsMap.get(item.project_id) ?? [];
    arr.push({
      id: item.id,
      projectId: item.project_id,
      originalItemId: item.original_item_id,
      name: item.item_name,
      description: item.description ?? '',
      quantity: Number(item.quantity) || 1,
      estimatedHours: Number(item.estimated_hours) || 0,
      revisionLimit: Number(item.revision_limit) || 0,
      priority: item.priority ?? 'medium',
      category: item.category ?? 'Feature',
      itemType: item.item_type,
      status: item.status,
      sortOrder: item.sort_order ?? 0,
    });
    itemsMap.set(item.project_id, arr);
  }

  return rows.map((row) => {
    const items = itemsMap.get(row.id) ?? [];
    const owner = ownerMap.get(row.user_id);
    return {
      id: row.id,
      userId: row.user_id,
      ownerName: owner?.fullName || undefined,
      ownerEmail: owner?.email || undefined,
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
      originalItems: items.filter((i) => i.itemType === 'original'),
      requestedItems: items.filter((i) => i.itemType === 'requested'),
      negotiationStrategy: 'accept_changes',
      swappedOutItemIds: [],
      deferredRequestIds: items
        .filter((i) => i.itemType === 'requested' && i.status === 'deferred')
        .map((i) => i.id),
      excludedRequestIds: [],
      scopeItemsCount: items.length,
      updatedAt: row.updated_at,
    };
  });
}

export async function getReportsCountAdmin(): Promise<number> {
  const supabase = getSupabaseClient();
  if (!supabase) return 0;

  const { count, error } = await supabase
    .from('project_reports')
    .select('id', { count: 'exact', head: true });

  if (error) return 0;
  return count ?? 0;
}

export async function updateProjectStatusAdmin(
  projectId: string,
  status: ProjectStatus
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Backend Supabase belum dikonfigurasi.');

  const { error } = await supabase
    .from('projects')
    .update({ status })
    .eq('id', projectId);

  if (error) {
    throw new Error(toSafeErrorMessage(error, 'Gagal memperbarui status proyek.'));
  }
}

export async function deleteProjectAdmin(projectId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Backend Supabase belum dikonfigurasi.');

  const { error } = await supabase.from('projects').delete().eq('id', projectId);

  if (error) {
    throw new Error(toSafeErrorMessage(error, 'Gagal menghapus proyek.'));
  }
}
