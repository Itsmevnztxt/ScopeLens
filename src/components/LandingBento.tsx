import React from 'react';
import scopeLogo from '../assets/mascot/logo.png';
import {
  ArrowLeftRight,
  ArrowRight,
  Calculator,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileText,
  FolderPlus,
  Lock,
  LogIn,
  LogOut,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import {
  formatCompactRupiah,
  formatHours,
  formatIndonesianDate,
  formatRupiah,
} from '../lib/formatters';
import type {
  NegotiationSimulationResult,
  Project,
  ScopeAnalysisResult,
  UserProfile,
} from '../types';
import { ScopeMascot } from './ScopeMascot';

interface LandingBentoProps {
  project: Project;
  analysis: ScopeAnalysisResult;
  simulation: NegotiationSimulationResult;
  user: UserProfile | null;
  supabaseReady: boolean;
  onStartStudio: () => void;
  onOpenAdmin: () => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onSignOut: () => void;
  onResetAndLoadSample: () => void;
}

const CORE_CAPABILITIES = [
  {
    title: 'Kunci Kontrak Awal',
    subtitle: 'Baseline terpisah',
    bg: 'bg-[#10B981]',
    icon: Lock,
  },
  {
    title: 'Deteksi Tambahan',
    subtitle: 'Anti hitung ganda',
    bg: 'bg-[#3B82F6]',
    icon: Sparkles,
  },
  {
    title: 'Tarif Rupiah Akurat',
    subtitle: 'Kalkulasi integer',
    bg: 'bg-[#F59E0B]',
    icon: Calculator,
  },
  {
    title: 'Kalender Hari Kerja',
    subtitle: 'Sabtu-Minggu & libur',
    bg: 'bg-[#8B5CF6]',
    icon: CalendarClock,
  },
  {
    title: 'Simulasi Tukar Fitur',
    subtitle: 'Jaga anggaran klien',
    bg: 'bg-[#EC4899]',
    icon: ArrowLeftRight,
  },
  {
    title: 'Pesan Siap Kirim',
    subtitle: 'WhatsApp & Email',
    bg: 'bg-[#06B6D4]',
    icon: MessageSquareText,
  },
];

const STRATEGY_CARDS = [
  {
    badge: 'Opsi 01',
    badgeBg: 'bg-[#FFE4E6] text-[#BE123C]',
    panelBg: 'bg-[#FFF1F2]',
    title: 'Terima & Sesuaikan Biaya',
    metric: '+Rp 900rb • +2 Hari',
    description:
      'Semua permintaan baru dikerjakan sekarang dengan penyesuaian anggaran dan tenggat waktu resmi.',
    icon: CheckCircle2,
    iconColor: 'text-[#BE123C]',
  },
  {
    badge: 'Paling Populer',
    badgeBg: 'bg-[#EDE9FE] text-[#6D28D9]',
    panelBg: 'bg-[#F5F3FF]',
    title: 'Tukar Fitur (Scope Swap)',
    metric: 'Rp 0 Selisih Biaya',
    description:
      'Klien memilih fitur baru dengan menukar fitur awal berdurasi setara agar anggaran tetap aman.',
    icon: ArrowLeftRight,
    iconColor: 'text-[#6D28D9]',
  },
  {
    badge: 'Opsi 03',
    badgeBg: 'bg-[#FEF3C7] text-[#B45309]',
    panelBg: 'bg-[#FFFBEB]',
    title: 'Pindahkan ke Fase 2',
    metric: 'Fase 1 Tetap Tepat Waktu',
    description:
      'Catat seluruh permintaan tambahan ke kontrak lanjutan tanpa mengganggu rilis proyek utama.',
    icon: Clock,
    iconColor: 'text-[#B45309]',
  },
];

const FREELANCER_STORIES = [
  {
    name: 'Raka Mahendra',
    role: 'Web Developer Lepas • Yogyakarta',
    initials: 'RM',
    avatarBg: 'bg-[#EDE9FE] text-[#6D28D9]',
    quote:
      'Dulu sungkan kalau klien minta tambah halaman admin di tengah jalan. Sekarang tinggal kirim ringkasan jam dan PDF-nya, klien langsung paham.',
  },
  {
    name: 'Nadia Kartika',
    role: 'UI/UX Designer • Bandung',
    initials: 'NK',
    avatarBg: 'bg-[#ECFDF5] text-[#047857]',
    quote:
      'Mode Tukar Fitur sangat membantu saat anggaran klien mentok. Tidak ada kerja gratis, tapi hubungan kerja tetap enak.',
  },
  {
    name: 'Dimas Prasetyo',
    role: 'Fullstack Freelancer • Surabaya',
    initials: 'DP',
    avatarBg: 'bg-[#FFF1F2] text-[#BE123C]',
    quote:
      'Kalender hari kerjanya rapi sekali. Tambahan 12 jam langsung terbaca jadi +2 hari kerja di luar akhir pekan, bukan tebak-tebakan.',
  },
];

export const LandingBento: React.FC<LandingBentoProps> = ({
  project,
  analysis,
  simulation,
  user,
  supabaseReady,
  onStartStudio,
  onOpenAdmin,
  onOpenAuth,
  onSignOut,
  onResetAndLoadSample,
}) => {
  const hasRealCloudProject = Boolean(user && supabaseReady && !project.isDemo);
  const isLoggedInWithoutProjects = Boolean(user && supabaseReady && project.isDemo);
  const firstName = user?.fullName?.trim()
    ? user.fullName.trim().split(' ')[0]
    : user?.email?.split('@')[0] ?? 'Freelancer';

  return (
    <div className="space-y-8 pb-6">
      {/* 1. Top Micro Announcement Strip */}
      <div className="rounded-full bg-[#7C3AED] text-white px-4 py-2 text-[11px] sm:text-xs font-semibold flex flex-wrap items-center justify-between gap-2 shadow-sm">
        <span>
          ScopeLens v2.0 — Deteksi tambahan kerja di luar kontrak sebelum merusak margin Anda
        </span>
        <span className="hidden sm:inline-flex items-center gap-1.5 text-white/90">
          <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Data proyek tersimpan aman &amp; real-time</span>
        </span>
      </div>

      {/* 2. Clean White Pill Navbar */}
      <header className="rounded-[24px] bg-white px-5 py-3.5 shadow-card flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl overflow-hidden shadow-sm">
            <img
              src={scopeLogo}
              alt="Logo ScopeLens"
              className="w-full h-full object-contain"
            />
          </span>
          <div>
            <span className="block text-base font-extrabold text-ink leading-tight">
              ScopeLens
            </span>
            <span className="block text-[11px] font-medium text-inkMuted">
              Pelindung Kesepakatan &amp; Margin Freelance
            </span>
          </div>
        </div>

        <nav
          aria-label="Navigasi landing page"
          className="hidden md:flex items-center gap-6 text-xs font-bold text-inkMuted"
        >
          <a href="#fitur-utama" className="hover:text-[#7C3AED] studio-transition">
            Fitur Utama
          </a>
          <a href="#opsi-negosiasi" className="hover:text-[#7C3AED] studio-transition">
            Strategi Negosiasi
          </a>
          <a href="#simulasi-nyata" className="hover:text-[#7C3AED] studio-transition">
            Simulasi Kasus
          </a>
          <a href="#cerita-freelancer" className="hover:text-[#7C3AED] studio-transition">
            Pengalaman Pengguna
          </a>
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          {user ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1.5 text-xs font-semibold text-ink">
                <span>Halo, {firstName}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    user.role === 'admin'
                      ? 'bg-[#8B5CF6] text-white'
                      : 'bg-[#ECFDF5] text-[#047857]'
                  }`}
                >
                  {user.role === 'admin' ? 'Admin' : 'User'}
                </span>
              </span>

              <button
                type="button"
                onClick={onStartStudio}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#8B5CF6] hover:bg-[#7C3AED] px-4 py-2 text-xs font-bold text-white shadow-sm studio-transition min-h-[38px]"
              >
                <span>Buka Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>

              {user.role === 'admin' && (
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className="inline-flex items-center gap-1.5 rounded-full bg-lavenderTint px-4 py-2 text-xs font-bold text-violetDeep hover:bg-[#8B5CF6] hover:text-white studio-transition min-h-[38px]"
                >
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Panel Admin</span>
                </button>
              )}

              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-3.5 py-2 text-xs font-bold text-inkMuted hover:bg-rose-50 hover:text-rose-700 studio-transition min-h-[38px]"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Keluar</span>
              </button>
            </>
          ) : supabaseReady ? (
            <>
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-4 py-2 text-xs sm:text-sm font-bold text-ink hover:bg-lavenderTint hover:text-violetDeep studio-transition min-h-[40px]"
              >
                <LogIn className="w-4 h-4 text-violetDeep" aria-hidden="true" />
                <span>Masuk</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenAuth('register')}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#8B5CF6] hover:bg-[#7C3AED] px-5 py-2 text-xs sm:text-sm font-bold text-white shadow-card studio-transition min-h-[40px]"
              >
                <UserPlus className="w-4 h-4" aria-hidden="true" />
                <span>Daftar Akun</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-4 py-2 text-xs font-bold text-inkMuted hover:bg-lavenderTint hover:text-violetDeep studio-transition min-h-[38px]"
              >
                <span>Penyimpanan Lokal</span>
              </button>
              <button
                type="button"
                onClick={onStartStudio}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#8B5CF6] hover:bg-[#7C3AED] px-4 py-2 text-xs font-bold text-white shadow-sm studio-transition min-h-[38px]"
              >
                <span>Buka Ruang Analisis</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* 3. Airy Editorial Hero Section (Referensi Visual Cozy Pastel + Playful Character Card) */}
      <section className="rounded-[32px] bg-white p-6 sm:p-10 lg:p-12 shadow-card overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left Typography & CTA Column */}
          <div className="lg:col-span-6 space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#FEF3C7] text-[#92400E] px-3.5 py-1.5 text-[11px] font-bold tracking-wide">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>DETECT • COMPARE • CALCULATE • NEGOTIATE</span>
            </span>

            <h1 className="text-3xl sm:text-4xl lg:text-[46px] font-extrabold text-ink leading-[1.12]">
              Klien Minta Tambah Fitur?{' '}
              <span className="text-[#8B5CF6]">Hitung Dampaknya</span> Sebelum Bilang Iya.
            </h1>

            <p className="text-sm sm:text-base text-inkMuted leading-relaxed max-w-xl">
              ScopeLens memisahkan kesepakatan awal dari permintaan baru klien, menghitung
              tambahan jam kerja, nilai Rupiah, dan pergeseran deadline, lalu menyusun pesan
              negosiasi yang tenang dan profesional.
            </p>

            {/* Primary & Secondary CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {user ? (
                <>
                  <button
                    type="button"
                    onClick={onStartStudio}
                    className="inline-flex items-center gap-2 rounded-full bg-[#8B5CF6] hover:bg-[#7C3AED] px-6 py-3.5 text-sm font-extrabold text-white shadow-card studio-transition"
                  >
                    <span>Buka Dashboard Proyek</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>

                  {user.role === 'admin' && (
                    <button
                      type="button"
                      onClick={onOpenAdmin}
                      className="inline-flex items-center gap-2 rounded-full border border-borderSoft bg-canvas hover:bg-lavenderTint px-5 py-3.5 text-sm font-bold text-ink studio-transition"
                    >
                      <ShieldCheck className="w-4 h-4 text-[#7C3AED]" aria-hidden="true" />
                      <span>Buka Panel Admin</span>
                    </button>
                  )}
                </>
              ) : supabaseReady ? (
                <>
                  <button
                    type="button"
                    onClick={() => onOpenAuth('login')}
                    className="inline-flex items-center gap-2 rounded-full bg-[#8B5CF6] hover:bg-[#7C3AED] px-6 py-3.5 text-sm font-extrabold text-white shadow-card studio-transition"
                  >
                    <LogIn className="w-4 h-4" aria-hidden="true" />
                    <span>Masuk ke Dashboard</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenAuth('register')}
                    className="inline-flex items-center gap-2 rounded-full border border-borderSoft bg-white hover:bg-lavenderTint px-5 py-3.5 text-sm font-bold text-ink studio-transition"
                  >
                    <UserPlus className="w-4 h-4 text-[#7C3AED]" aria-hidden="true" />
                    <span>Daftar Akun Baru</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onStartStudio}
                    className="inline-flex items-center gap-2 rounded-full bg-[#8B5CF6] hover:bg-[#7C3AED] px-6 py-3.5 text-sm font-extrabold text-white shadow-card studio-transition"
                  >
                    <span>Buka Ruang Analisis</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={onResetAndLoadSample}
                    className="inline-flex items-center gap-2 rounded-full border border-borderSoft bg-white hover:bg-lavenderTint px-5 py-3.5 text-sm font-bold text-ink studio-transition"
                  >
                    <span>Muat Contoh Kasus</span>
                  </button>
                </>
              )}
            </div>

            {/* Category / Benefit Tag Pills */}
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                'Baseline Terkunci',
                'Hitung Rupiah Integer',
                'Kalender Hari Kerja',
                'Tukar Fitur (Swap)',
                'Ekspor PDF A4',
              ].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-canvas px-3 py-1 text-[11px] font-semibold text-inkMuted"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Trust Micro-Row */}
            <div className="flex items-center gap-3 pt-2">
              <div className="flex -space-x-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#EDE9FE] text-[11px] font-bold text-[#6D28D9] ring-2 ring-white">
                  RM
                </span>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#ECFDF5] text-[11px] font-bold text-[#047857] ring-2 ring-white">
                  NK
                </span>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#FFF1F2] text-[11px] font-bold text-[#BE123C] ring-2 ring-white">
                  DP
                </span>
              </div>
              <p className="text-xs font-medium text-inkMuted">
                Dipercaya freelancer web, desain UI/UX, dan agensi kecil untuk menjaga margin proyek
              </p>
            </div>
          </div>

          {/* Right Playful Cozy Showcase Card (Karakter Lensy + Floating Badges) */}
          <div className="lg:col-span-6">
            {isLoggedInWithoutProjects ? (
              <div className="rounded-[28px] bg-canvas p-6 sm:p-8 space-y-5">
                <div className="space-y-2">
                  <span className="inline-flex items-center rounded-full bg-lavenderTint px-3 py-1 text-[11px] font-bold text-violetDeep">
                    Akun Terhubung
                  </span>
                  <h2 className="text-xl font-extrabold text-ink">
                    Belum ada proyek di akun Anda
                  </h2>
                  <p className="text-xs sm:text-sm text-inkMuted leading-relaxed">
                    Masuk ke Dashboard untuk membuat proyek pertama langsung ke database akun Anda
                    dan mulai melacak kesepakatan dengan klien.
                  </p>
                </div>

                <ScopeMascot
                  variant="card"
                  compact
                  mood="calm"
                  message="Semua data proyek, tarif per jam, dan laporan PDF akan tersimpan rapi di akun Anda."
                />

                <button
                  type="button"
                  onClick={onStartStudio}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#8B5CF6] hover:bg-[#7C3AED] px-5 py-3 text-sm font-bold text-white shadow-card studio-transition min-h-[44px]"
                >
                  <FolderPlus className="w-4 h-4" aria-hidden="true" />
                  <span>Masuk ke Dashboard &amp; Buat Proyek</span>
                </button>
              </div>
            ) : (
              <div className="relative rounded-[30px] hero-focal-gradient p-6 sm:p-8 text-white shadow-card">
                {/* Floating Badge Top-Left */}
                <div className="inline-flex items-center gap-2 rounded-full bg-white text-ink px-3.5 py-1.5 text-xs font-bold shadow-md">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]" aria-hidden="true" />
                  <span>Baseline 20 Jam Terkunci</span>
                </div>

                {/* Center Mascot Illustration */}
                <div className="my-4 flex flex-col items-center justify-center">
                  <ScopeMascot variant="hero" mood={analysis.hasScopeCreep ? 'alert' : 'calm'} />
                </div>

                {/* Floating Stat Pills Bottom */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white text-ink px-4 py-3 shadow-md">
                    <span className="block text-[11px] font-semibold text-inkMuted">
                      Tambahan Terdeteksi
                    </span>
                    <span className="font-numeric text-base font-extrabold text-[#BE123C]">
                      {simulation.additionalCostNow > 0 ? '+' : ''}
                      {formatCompactRupiah(simulation.additionalCostNow)}
                    </span>
                    <span className="block font-numeric text-[11px] text-inkMuted">
                      {simulation.additionalHoursNow > 0 ? '+' : ''}
                      {formatHours(simulation.additionalHoursNow)} di luar awal
                    </span>
                  </div>

                  <div className="rounded-2xl bg-white text-ink px-4 py-3 shadow-md">
                    <span className="block text-[11px] font-semibold text-inkMuted">
                      Pergeseran Jadwal
                    </span>
                    <span className="font-numeric text-base font-extrabold text-[#7C3AED]">
                      {simulation.additionalWorkingDays > 0
                        ? `+${simulation.additionalWorkingDays} Hari Kerja`
                        : 'Tepat Waktu'}
                    </span>
                    <span className="block font-numeric text-[11px] text-inkMuted">
                      Target: {formatIndonesianDate(simulation.revisedDeadline)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. Horizontal Trust / Value Strip */}
      <section
        aria-label="Keunggulan utama ScopeLens"
        className="rounded-[24px] bg-white px-5 py-4 shadow-card grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4"
      >
        {[
          { icon: ShieldCheck, title: 'Baseline Aman', desc: 'Tidak tertimpa revisi' },
          { icon: Calculator, title: 'Bebas Hitung Ganda', desc: 'ID item unik' },
          { icon: CalendarClock, title: 'Hari Kerja Nyata', desc: 'Lewati akhir pekan' },
          { icon: MessageSquareText, title: 'Pesan Negosiasi', desc: 'Sopan & lugas' },
          { icon: FileCheck2, title: 'Arsip PDF A4', desc: 'Siap kirim ke klien' },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lavenderTint text-[#7C3AED]">
              <Icon className="w-4 h-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-ink truncate">{title}</p>
              <p className="text-[11px] text-inkMuted truncate">{desc}</p>
            </div>
          </div>
        ))}
      </section>

      {/* 5. Neatly Sorted Capability Grid (Referensi ToyStore Squircle Grid) */}
      <section id="fitur-utama" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2 px-1">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#7C3AED]">
              Fitur Terstruktur
            </p>
            <h2 className="text-2xl font-extrabold text-ink mt-0.5">
              Semua Kebutuhan Kontrol Proyek, Rapi dalam Satu Alur
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {CORE_CAPABILITIES.map(({ title, subtitle, bg, icon: Icon }) => (
            <div
              key={title}
              className="rounded-[22px] bg-white p-5 shadow-card flex flex-col items-center text-center studio-transition hover:shadow-cardHover"
            >
              <span
                className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${bg} text-white shadow-sm mb-3`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
              </span>
              <h3 className="text-xs sm:text-sm font-extrabold text-ink">{title}</h3>
              <p className="text-[11px] text-inkMuted mt-1">{subtitle}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Featured Negotiation Options (Referensi 3 Pastel Showcase Cards) */}
      <section id="opsi-negosiasi" className="space-y-4">
        <div className="px-1">
          <p className="text-xs font-bold uppercase tracking-wider text-[#7C3AED]">
            Tiga Pilihan Strategi
          </p>
          <h2 className="text-2xl font-extrabold text-ink mt-0.5">
            Negosiasi Perubahan Tanpa Drama
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {STRATEGY_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.title}
                className="rounded-[24px] bg-white p-4 shadow-card flex flex-col justify-between space-y-4 studio-transition hover:shadow-cardHover"
              >
                <div className={`rounded-2xl ${card.panelBg} p-5 flex items-center justify-between`}>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${card.badgeBg}`}>
                    {card.badge}
                  </span>
                  <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm ${card.iconColor}`}>
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </span>
                </div>

                <div className="px-1 pb-2 space-y-1.5">
                  <h3 className="text-base font-extrabold text-ink">{card.title}</h3>
                  <p className="font-numeric text-xs font-bold text-[#7C3AED]">{card.metric}</p>
                  <p className="text-xs sm:text-sm text-inkMuted leading-relaxed">
                    {card.description}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 7. Soft Pastel Live Simulation Preview (Referensi Editorial Section) */}
      <section
        id="simulasi-nyata"
        className="rounded-[32px] bg-[#EFEBF9] p-6 sm:p-9 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center"
      >
        <div className="lg:col-span-5 space-y-3">
          <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-bold text-[#7C3AED] shadow-sm">
            {hasRealCloudProject ? 'Proyek Aktif Anda' : 'Ilustrasi Simulasi ScopeLens'}
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-ink leading-tight">
            {project.name}
          </h2>
          <p className="text-xs sm:text-sm text-inkMuted leading-relaxed">
            Klien: <strong className="text-ink">{project.clientName}</strong> • Tarif{' '}
            <span className="font-numeric font-bold text-ink">
              {formatRupiah(project.hourlyRate)}/jam
            </span>
            . Lihat bagaimana permintaan tambahan otomatis terhitung menjadi selisih biaya dan
            pergeseran deadline.
          </p>

          <div className="pt-2">
            {user ? (
              <button
                type="button"
                onClick={onStartStudio}
                className="inline-flex items-center gap-2 rounded-full bg-[#8B5CF6] hover:bg-[#7C3AED] px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-sm studio-transition"
              >
                <span>Kelola di Dashboard</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            ) : supabaseReady ? (
              <button
                type="button"
                onClick={() => onOpenAuth('register')}
                className="inline-flex items-center gap-2 rounded-full bg-[#8B5CF6] hover:bg-[#7C3AED] px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-sm studio-transition"
              >
                <span>Coba dengan Akun Anda</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onStartStudio}
                className="inline-flex items-center gap-2 rounded-full bg-[#8B5CF6] hover:bg-[#7C3AED] px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-sm studio-transition"
              >
                <span>Buka Simulasi Lengkap</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <span className="block text-[11px] font-semibold text-inkMuted">Kesepakatan Awal</span>
            <span className="mt-1.5 block font-numeric text-lg font-extrabold text-ink">
              {formatHours(analysis.originalHours)}
            </span>
            <span className="block font-numeric text-xs text-inkMuted mt-0.5">
              {formatCompactRupiah(project.initialPrice)}
            </span>
          </div>

          <div className="rounded-2xl bg-[#FFF1F2] p-4 shadow-sm">
            <span className="block text-[11px] font-semibold text-[#BE123C]">Beban Tambahan</span>
            <span className="mt-1.5 block font-numeric text-lg font-extrabold text-[#BE123C]">
              {simulation.additionalHoursNow > 0 ? '+' : ''}
              {formatHours(simulation.additionalHoursNow)}
            </span>
            <span className="block font-numeric text-xs text-[#BE123C] mt-0.5">
              {formatCompactRupiah(simulation.additionalCostNow, true)}
            </span>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <span className="block text-[11px] font-semibold text-inkMuted">Estimasi Total</span>
            <span className="mt-1.5 block font-numeric text-lg font-extrabold text-[#7C3AED]">
              {formatCompactRupiah(simulation.revisedPrice)}
            </span>
            <span className="block font-numeric text-[11px] text-inkMuted mt-0.5">
              {formatRupiah(simulation.revisedPrice)}
            </span>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <span className="block text-[11px] font-semibold text-inkMuted">Target Selesai</span>
            <span className="mt-1.5 block font-numeric text-sm font-extrabold text-ink">
              {formatIndonesianDate(simulation.revisedDeadline)}
            </span>
            <span className="block font-numeric text-[11px] text-inkMuted mt-0.5">
              {simulation.additionalWorkingDays > 0
                ? `+${simulation.additionalWorkingDays} hari kerja`
                : 'Sesuai jadwal awal'}
            </span>
          </div>
        </div>
      </section>

      {/* 8. Freelancer Stories (Referensi "What Parents Say" 3-Column Card Row) */}
      <section id="cerita-freelancer" className="space-y-4">
        <div className="text-center max-w-2xl mx-auto space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-[#7C3AED]">
            Pengalaman Pengguna
          </p>
          <h2 className="text-2xl font-extrabold text-ink">
            Mengapa Freelancer Memakai ScopeLens
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {FREELANCER_STORIES.map((story) => (
            <div key={story.name} className="rounded-[24px] bg-white p-6 shadow-card space-y-4">
              <p className="text-xs sm:text-sm text-inkMuted leading-relaxed">
                &ldquo;{story.quote}&rdquo;
              </p>
              <div className="flex items-center gap-3 pt-1">
                <span
                  className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${story.avatarBg}`}
                >
                  {story.initials}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-ink truncate">{story.name}</p>
                  <p className="text-[11px] text-inkMuted truncate">{story.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 9. Bottom Soft Pastel CTA Banner */}
      <section className="rounded-[28px] bg-white p-6 sm:p-8 shadow-card flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <h2 className="text-xl font-extrabold text-ink">
            Siap menjaga setiap proyek tetap adil dan terukur?
          </h2>
          <p className="text-xs sm:text-sm text-inkMuted">
            Catat kesepakatan awal, hitung dampak perubahan, dan kirim pesan negosiasi dalam
            hitungan menit.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {user ? (
            <button
              type="button"
              onClick={onStartStudio}
              className="inline-flex items-center gap-2 rounded-full bg-[#8B5CF6] hover:bg-[#7C3AED] px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-sm studio-transition"
            >
              <span>Masuk ke Dashboard</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          ) : supabaseReady ? (
            <button
              type="button"
              onClick={() => onOpenAuth('register')}
              className="inline-flex items-center gap-2 rounded-full bg-[#8B5CF6] hover:bg-[#7C3AED] px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-sm studio-transition"
            >
              <UserPlus className="w-4 h-4" aria-hidden="true" />
              <span>Mulai Gratis Sekarang</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onStartStudio}
              className="inline-flex items-center gap-2 rounded-full bg-[#8B5CF6] hover:bg-[#7C3AED] px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-sm studio-transition"
            >
              <FileText className="w-4 h-4" aria-hidden="true" />
              <span>Buka Ruang Analisis</span>
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
