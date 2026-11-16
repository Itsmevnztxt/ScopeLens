import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase';
import { sanitizeText } from '../lib/sanitize';
import type { UserProfile, UserRole } from '../types';

export function normalizeUserRole(raw: unknown): UserRole {
  return raw === 'admin' ? 'admin' : 'user';
}

export function toSafeErrorMessage(err: unknown, fallback = 'Terjadi kesalahan saat memproses permintaan.'): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const raw = String((err as { message: unknown }).message);
    if (raw.includes('Invalid login credentials')) {
      return 'Email atau kata sandi tidak sesuai.';
    }
    if (raw.includes('User already registered')) {
      return 'Email ini sudah terdaftar. Silakan masuk.';
    }
    if (raw.includes('Password should be at least')) {
      return 'Kata sandi minimal 6 karakter.';
    }
    if (raw.includes('Unauthorized') || raw.includes('JWT')) {
      return 'Sesi Anda telah berakhir. Silakan masuk kembali.';
    }
    if (raw.includes('Cannot demote the last remaining administrator')) {
      return 'Tidak dapat menurunkan role admin terakhir.';
    }
    if (raw.includes('Forbidden:') || raw.includes('row-level security') || raw.includes('permission denied')) {
      return 'Anda tidak memiliki izin untuk mengakses atau mengubah data ini.';
    }
    // Hindari membocorkan detail SQL mentah
    if (raw.includes('violates') || raw.includes('relation ') || raw.includes('column ')) {
      return fallback;
    }
    return raw;
  }
  return fallback;
}

export async function registerUser(
  email: string,
  password: string,
  fullName: string
): Promise<{ user: UserProfile | null; needsEmailConfirmation: boolean }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Backend Supabase belum dikonfigurasi pada environment (.env).');
  }

  const cleanEmail = sanitizeText(email, 160).toLowerCase();
  const cleanName = sanitizeText(fullName, 120);

  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Masukkan alamat email yang valid.');
  }
  if (!password || password.length < 6) {
    throw new Error('Kata sandi minimal 6 karakter.');
  }

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: { full_name: cleanName },
    },
  });

  if (error) {
    throw new Error(toSafeErrorMessage(error, 'Pendaftaran akun gagal.'));
  }

  if (!data.user) {
    throw new Error('Gagal membuat akun pengguna.');
  }

  const profile = data.session ? await getUserProfile(data.user.id) : null;

  return {
    user: profile ?? {
      id: data.user.id,
      email: data.user.email ?? cleanEmail,
      fullName: cleanName,
      role: 'user',
    },
    needsEmailConfirmation: !data.session,
  };
}

export async function loginUser(email: string, password: string): Promise<UserProfile> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Backend Supabase belum dikonfigurasi pada environment (.env).');
  }

  const cleanEmail = sanitizeText(email, 160).toLowerCase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });

  if (error || !data.user) {
    throw new Error(toSafeErrorMessage(error, 'Gagal masuk ke akun.'));
  }

  const profile = await getUserProfile(data.user.id);
  return (
    profile ?? {
      id: data.user.id,
      email: data.user.email ?? cleanEmail,
      fullName: String(data.user.user_metadata?.full_name ?? ''),
      role: 'user',
    }
  );
}

export async function logoutUser(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(toSafeErrorMessage(error, 'Gagal keluar dari sesi.'));
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Backend Supabase belum dikonfigurasi.');
  }
  const cleanEmail = sanitizeText(email, 160).toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Masukkan alamat email yang valid.');
  }
  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
  });
  if (error) {
    throw new Error(toSafeErrorMessage(error, 'Gagal mengirim tautan reset kata sandi.'));
  }
}

export async function getCurrentSession(): Promise<Session | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    fullName: data.full_name ?? '',
    email: data.email ?? '',
    role: normalizeUserRole(data.role),
    createdAt: data.created_at ?? undefined,
    updatedAt: data.updated_at ?? undefined,
  };
}

export async function updateUserProfile(
  userId: string,
  fullName: string
): Promise<UserProfile> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Backend Supabase belum dikonfigurasi.');
  }

  const cleanName = sanitizeText(fullName, 120);
  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: cleanName })
    .eq('id', userId)
    .select('id, full_name, email, role, created_at, updated_at')
    .single();

  if (error || !data) {
    throw new Error(toSafeErrorMessage(error, 'Gagal memperbarui profil.'));
  }

  return {
    id: data.id,
    fullName: data.full_name ?? cleanName,
    email: data.email ?? '',
    role: normalizeUserRole(data.role),
    createdAt: data.created_at ?? undefined,
    updatedAt: data.updated_at ?? undefined,
  };
}
