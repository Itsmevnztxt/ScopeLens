import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase';
import type { RealtimeConnectionStatus, UserRole } from '../types';

export interface RealtimeChangeEvent {
  table: 'profiles' | 'projects' | 'scope_items' | 'negotiations' | 'project_reports';
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  recordId?: string;
  projectId?: string;
  userId?: string;
}

interface SubscribeRealtimeParams {
  userId: string;
  role: UserRole;
  onStatusChange: (status: RealtimeConnectionStatus) => void;
  onDatabaseChange: (event: RealtimeChangeEvent) => void;
}

function extractStringField(
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
  key: string
): string | undefined {
  const nextVal = payload.new && typeof payload.new === 'object' ? (payload.new as Record<string, unknown>)[key] : undefined;
  if (typeof nextVal === 'string' && nextVal.length > 0) return nextVal;
  const oldVal = payload.old && typeof payload.old === 'object' ? (payload.old as Record<string, unknown>)[key] : undefined;
  if (typeof oldVal === 'string' && oldVal.length > 0) return oldVal;
  return undefined;
}

export function subscribeScopeLensRealtime({
  userId,
  role,
  onStatusChange,
  onDatabaseChange,
}: SubscribeRealtimeParams): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) {
    onStatusChange('unconfigured');
    return () => {};
  }

  onStatusChange('connecting');

  let disposed = false;
  const channelName = `scopelens-live-${role}-${userId}-${Date.now()}`;
  let channel: RealtimeChannel = supabase.channel(channelName);

  const handlePayload =
    (table: RealtimeChangeEvent['table']) =>
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (disposed) return;
      const recordId = extractStringField(payload, 'id');
      const projectId =
        table === 'projects'
          ? recordId
          : extractStringField(payload, 'project_id');
      const rowUserId =
        table === 'profiles'
          ? recordId
          : extractStringField(payload, 'user_id');

      onDatabaseChange({
        table,
        eventType: payload.eventType,
        recordId,
        projectId,
        userId: rowUserId,
      });
    };

  // RLS di PostgreSQL memastikan user biasa hanya menerima baris miliknya,
  // sedangkan admin menerima pembaruan lintas pengguna secara real-time.
  channel = channel
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'projects' },
      handlePayload('projects')
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'scope_items' },
      handlePayload('scope_items')
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'negotiations' },
      handlePayload('negotiations')
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'project_reports' },
      handlePayload('project_reports')
    )
    .on(
      'postgres_changes',
      role === 'admin'
        ? { event: '*', schema: 'public', table: 'profiles' }
        : { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
      handlePayload('profiles')
    );

  channel.subscribe((status) => {
    if (disposed) return;
    if (status === 'SUBSCRIBED') {
      onStatusChange('connected');
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      onStatusChange('error');
    } else if (status === 'CLOSED') {
      onStatusChange('offline');
    }
  });

  return () => {
    if (disposed) return;
    disposed = true;
    onStatusChange('offline');
    void supabase.removeChannel(channel);
  };
}
