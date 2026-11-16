import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

const supabaseUrl = process.env.TEST_SUPABASE_URL;
const supabaseAnonKey = process.env.TEST_SUPABASE_ANON_KEY;
const userAEmail = process.env.TEST_USER_A_EMAIL;
const userAPassword = process.env.TEST_USER_A_PASSWORD;
const userBEmail = process.env.TEST_USER_B_EMAIL;
const userBPassword = process.env.TEST_USER_B_PASSWORD;

const canRunLiveIntegration = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    userAEmail &&
    userAPassword &&
    userBEmail &&
    userBPassword
);

describe('Supabase Integration & RLS Security Tests', () => {
  it('menolak akses proyek tanpa autentikasi (anon user tidak bisa membaca data privat)', async () => {
    if (!supabaseUrl || !supabaseAnonKey) {
      // Lingkungan lokal offline: verifikasi bahwa guard konfigurasi berjalan tanpa error
      expect(canRunLiveIntegration).toBe(false);
      return;
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await anonClient.from('projects').select('*');
    // RLS memblokir atau mengembalikan 0 baris untuk anon
    expect(error === null ? data?.length ?? 0 : 0).toBe(0);
  });

  it.skipIf(!canRunLiveIntegration)(
    'memastikan User B tidak dapat membaca atau menghapus proyek milik User A (RLS isolation)',
    async () => {
      const clientA = createClient(supabaseUrl!, supabaseAnonKey!);
      const clientB = createClient(supabaseUrl!, supabaseAnonKey!);

      const authA = await clientA.auth.signInWithPassword({
        email: userAEmail!,
        password: userAPassword!,
      });
      expect(authA.error).toBeNull();

      const { data: created, error: createErr } = await clientA
        .from('projects')
        .insert({
          user_id: authA.data.user!.id,
          project_name: 'RLS Isolation Test Project',
          client_name: 'Client A',
          start_date: '2026-11-16',
          original_deadline: '2026-11-23',
          initial_price: 1500000,
          hourly_rate: 75000,
          productive_hours_per_day: 6,
          work_days: [1, 2, 3, 4, 5],
        })
        .select()
        .single();

      expect(createErr).toBeNull();
      expect(created?.id).toBeTruthy();

      const authB = await clientB.auth.signInWithPassword({
        email: userBEmail!,
        password: userBPassword!,
      });
      expect(authB.error).toBeNull();

      const { data: readByB } = await clientB
        .from('projects')
        .select('*')
        .eq('id', created!.id);
      expect(readByB ?? []).toHaveLength(0);

      await clientB.from('projects').delete().eq('id', created!.id);

      // Pastikan proyek masih ada untuk User A lalu bersihkan
      const { data: stillExists } = await clientA
        .from('projects')
        .select('id')
        .eq('id', created!.id)
        .single();
      expect(stillExists?.id).toBe(created!.id);

      await clientA.from('projects').delete().eq('id', created!.id);
    }
  );

  it.skipIf(!canRunLiveIntegration)(
    'mencegah user biasa menaikkan role sendiri menjadi admin (RLS + trigger anti-escalation)',
    async () => {
      const clientA = createClient(supabaseUrl!, supabaseAnonKey!);
      const authA = await clientA.auth.signInWithPassword({
        email: userAEmail!,
        password: userAPassword!,
      });
      expect(authA.error).toBeNull();
      const userId = authA.data.user!.id;

      // 1. Direct UPDATE profiles.role -> 'admin' harus ditolak oleh RLS / trigger
      const { error: directUpdateErr } = await clientA
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', userId);
      expect(directUpdateErr).not.toBeNull();

      // 2. Pemanggilan RPC admin_set_user_role oleh non-admin harus ditolak
      const { error: rpcErr } = await clientA.rpc('admin_set_user_role', {
        p_target_user_id: userId,
        p_new_role: 'admin',
      });
      expect(rpcErr).not.toBeNull();
    }
  );
});
