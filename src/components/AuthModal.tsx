import React, { useEffect, useId, useState } from 'react';
import { Eye, EyeOff, Shield, X } from 'lucide-react';
import { requestPasswordReset } from '../services';
import { NativeDialog } from './NativeDialog';

interface AuthModalProps {
  open: boolean;
  supabaseReady: boolean;
  initialMode?: 'login' | 'register' | 'reset';
  onClose: () => void;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ needsEmailConfirmation: boolean }>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  supabaseReady,
  initialMode = 'login',
  onClose,
  onSignIn,
  onSignUp,
}) => {
  const titleId = useId();
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>(initialMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(
    null
  );

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setFeedback(null);
    } else {
      setPassword('');
      setShowPassword(false);
      setFeedback(null);
    }
  }, [open, initialMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSubmitting(true);

    try {
      if (mode === 'login') {
        await onSignIn(email, password);
        onClose();
      } else if (mode === 'register') {
        const res = await onSignUp(email, password, fullName);
        if (res.needsEmailConfirmation) {
          setFeedback({
            type: 'success',
            text: 'Akun dibuat! Cek email Anda untuk verifikasi sebelum masuk.',
          });
        } else {
          onClose();
        }
      } else {
        await requestPasswordReset(email);
        setFeedback({
          type: 'success',
          text: 'Tautan reset kata sandi telah dikirim ke email Anda.',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Autentikasi gagal.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <NativeDialog open={open} onClose={onClose} labelledBy={titleId}>
      <div className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 id={titleId} className="text-xl font-bold text-ink">
              {supabaseReady ? 'Akun Cloud ScopeLens' : 'Penyimpanan Lokal Aktif'}
            </h2>
            <p className="text-xs text-inkMuted mt-1">
              {supabaseReady
                ? 'Masuk untuk menyimpan banyak proyek dan arsip laporan perubahan secara online.'
                : 'Semua perubahan ruang lingkup saat ini tersimpan otomatis di browser Anda tanpa perlu masuk akun.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog akun"
            className="rounded-xl p-2 text-inkMuted hover:text-ink hover:bg-subtle min-h-[40px] min-w-[40px] inline-flex items-center justify-center"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {!supabaseReady ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-lavenderTint/60 p-4 text-xs text-ink space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-violetDeep">
                <Shield className="w-4 h-4" aria-hidden="true" />
                <span>Koneksi Supabase Belum Dikonfigurasi</span>
              </div>
              <p className="leading-relaxed text-inkMuted">
                Saat ini aplikasi berjalan di penyimpanan lokal browser karena variabel{' '}
                <code className="font-numeric font-bold text-ink">VITE_SUPABASE_URL</code> dan{' '}
                <code className="font-numeric font-bold text-ink">VITE_SUPABASE_ANON_KEY</code>{' '}
                belum diisi di file <code className="font-numeric font-bold text-ink">.env.local</code>.
              </p>
              <ol className="list-decimal pl-4 space-y-1 text-inkMuted leading-relaxed">
                <li>Salin <code className="font-numeric text-ink">.env.example</code> menjadi <code className="font-numeric text-ink">.env.local</code> lalu isi Project URL &amp; Anon Key Supabase Anda.</li>
                <li>Jalankan 4 file SQL di <code className="font-numeric text-ink">supabase/migrations/</code> secara berurutan pada Supabase SQL Editor.</li>
                <li>Daftar akun melalui modal ini, lalu promosikan akun Admin pertama dengan <code className="font-numeric text-ink">UPDATE public.profiles SET role = &apos;admin&apos; WHERE email = &apos;...&apos;;</code>.</li>
              </ol>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full cta-focal-gradient rounded-full py-2.5 text-sm font-bold text-white min-h-[44px]"
            >
              Lanjutkan di Workspace
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex rounded-xl border border-borderSoft bg-canvas p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setFeedback(null);
                }}
                className={`flex-1 rounded-lg py-2 ${
                  mode === 'login' ? 'bg-surface text-violetPrimary shadow-sm' : 'text-inkMuted'
                }`}
              >
                Masuk
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setFeedback(null);
                }}
                className={`flex-1 rounded-lg py-2 ${
                  mode === 'register' ? 'bg-surface text-violetPrimary shadow-sm' : 'text-inkMuted'
                }`}
              >
                Daftar Baru
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('reset');
                  setFeedback(null);
                }}
                className={`flex-1 rounded-lg py-2 ${
                  mode === 'reset' ? 'bg-surface text-violetPrimary shadow-sm' : 'text-inkMuted'
                }`}
              >
                Reset Sandi
              </button>
            </div>

            {mode === 'register' && (
              <div>
                <label htmlFor="auth-fullname" className="block text-sm font-semibold text-ink mb-1">
                  Nama Lengkap
                </label>
                <input
                  id="auth-fullname"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-borderSoft bg-surface px-3.5 py-2.5 text-sm text-ink min-h-[44px]"
                />
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-sm font-semibold text-ink mb-1">
                Email
              </label>
              <input
                id="auth-email"
                name="email"
                type="email"
                autoComplete="email"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-borderSoft bg-surface px-3.5 py-2.5 text-sm text-ink min-h-[44px]"
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <label htmlFor="auth-password" className="block text-sm font-semibold text-ink mb-1">
                  Kata Sandi
                </label>
                <div className="relative">
                  <input
                    id="auth-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    minLength={6}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-borderSoft bg-surface px-3.5 py-2.5 pr-11 text-sm text-ink min-h-[44px]"
                  />
                  <button
                    type="button"
                    aria-pressed={showPassword}
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-inkMuted hover:text-ink"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <Eye className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {feedback && (
              <div
                role="alert"
                className={`rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${
                  feedback.type === 'error'
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                }`}
              >
                {feedback.text}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full cta-focal-gradient rounded-full py-2.5 text-sm font-bold text-white shadow-card min-h-[44px] disabled:opacity-60"
            >
              {submitting
                ? 'Memproses...'
                : mode === 'login'
                  ? 'Masuk ke ScopeLens'
                  : mode === 'register'
                    ? 'Buat Akun'
                    : 'Kirim Tautan Reset'}
            </button>
          </form>
        )}
      </div>
    </NativeDialog>
  );
};
