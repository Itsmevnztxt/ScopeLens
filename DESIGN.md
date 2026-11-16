# DESIGN.md — ScopeLens Design System (Cozy Pastel Bento Edition)

> Single source of truth untuk identitas visual, tata letak, tipografi, palet warna, maskot, dan copywriting **ScopeLens**.

---

## 1. Filosofi Visual & Art Direction
**Cozy Pastel Bento & Playful Character UI**: hangat, bersih, taktil, dan bersahabat—dirancang untuk meredakan kecemasan freelancer saat menghadapi permintaan perubahan di luar kontrak tanpa mengorbankan ketelitian angka finansial.

### Prinsip Anti-Slop & Impeccable
1. **Tanpa Dekorasi Generik:** Tidak ada teks gradasi (`bg-clip-text`), tidak ada border kaku berulang, tidak ada grid fitur simetris klise, dan tidak ada jargon developer/AI yang bocor ke antarmuka pengguna.
2. **Satu Fokus Gradasi per Layar:** Gradasi lavender lembut (`#8B5CF6 → #A78BFA`) **hanya** digunakan pada **Lavender Focal Hero Banner** dan tombol aksi utama. Seluruh kartu data, sparkline, dan panel strategi memakai permukaan putih solid yang bersih.
3. **Kejelasan Angka Finansial:** Setiap nominal Rupiah, durasi jam, dan selisih hari kerja memakai angka tabular (`tabular-nums`) agar tidak bergeser saat simulasi berubah secara *real-time*.

---

## 2. Arsitektur 3-Zone Cozy Pastel Bento Shell

| Zona | Peran | Detail Layout |
| :--- | :--- | :--- |
| **Zona A — Slim Floating Icon Rail** | Navigasi ramping sisi kiri (desktop) / *bottom bar* (mobile) | `w-20`, `bg-white`, `rounded-[28px]`, bayangan lembut. Berisi logo `SL`, Analisis Ruang Lingkup, Proyek Tersimpan, Pratinjau Laporan PDF, dan Pengaturan Tarif & Jam Kerja. Ikon aktif memakai kapsul `#8B5CF6` dengan ikon putih. |
| **Zona B — Main Bento Workspace** | Kolom tengah utama untuk membaca & menyunting proyek | 1. Top Greeting (`Halo, Freelancer 👋`) & 2 aksi utama (`+ Permintaan Baru`, `Cetak Laporan A4`).<br>2. Lavender Focal Hero Banner + Maskot `<ScopeMascot />` 2.5D/3D bervolume.<br>3. 3 Kartu Metrik Sparkline (`Dampak Biaya`, `Tambahan Waktu`, `Estimasi Total`).<br>4. Perbandingan Ruang Lingkup 2 kolom taktil (`Kesepakatan Awal` vs `Permintaan Terbaru Klien`). |
| **Zona C — Right Strategy & Message Panel** | Panel kanan persisten (`bg-white`, `rounded-[28px]`) | Pilihan 3 strategi negosiasi (*Terima & Sesuaikan Biaya*, *Tukar Fitur*, *Pindahkan ke Fase 2*) beserta *checklist* penukaran langsung + pratinjau pesan WhatsApp / Email siap salin. |

---

## 3. Palet Warna & Permukaan

| Token | Hex | Penggunaan |
| :--- | :--- | :--- |
| `--bg-canvas` | `#F6F4FB` | Canvas utama **Soft Lavender Cream** |
| `--bg-surface` | `#FFFFFF` | Kartu bento utama, rail navigasi, panel kanan |
| `--bg-subtle` | `#EFEBF9` | Permukaan dalam lembut / preview pesan / tag netral |
| `--border-soft` | `#ECE8F6` | Garis pemisah sangat halus (dipakai minimal) |
| `--text-primary` | `#1E1B2E` | Teks utama & angka kontrak (kontras > 12:1) |
| `--text-secondary` | `#5E5873` | Subjudul & metadata |
| `--accent-primary` | `#8B5CF6` | Soft Violet untuk kapsul aktif, tombol pill utama, dan fokus |
| `--accent-secondary` | `#A78BFA` | Pasangan gradasi pada Hero Banner |
| `--accent-tint` | `#F3EEFF` | Latar sorotan aktif lembut |

### Pil Status Bahasa Indonesia
- **`Sesuai Awal`** (Mint): `#ECFDF5` bg | `#047857` text
- **`Permintaan Baru`** (Coral): `#FFF1F2` bg | `#BE123C` text
- **`Diubah`** (Amber): `#FFFBEB` bg | `#B45309` text
- **`Dihapus`** (Rose): `#FEF2F2` bg | `#991B1B` text
- **`Ditukar`** (Slate): `#F1F5F9` bg | `#475569` text
- **`Fase 2`** (Lavender): `#F3EEFF` bg | `#6D28D9` text

---

## 4. Tipografi & Gerak
- **UI & Judul:** `Plus Jakarta Sans` (`-0.02em` tracking pada judul).
- **Angka & Tanggal:** `JetBrains Mono` dengan `font-variant-numeric: tabular-nums`.
- **Motion:** `180ms cubic-bezier(0.22, 1, 0.36, 1)` untuk transisi kartu, dialog, dan pembaruan angka; menghormati `prefers-reduced-motion: reduce`.

---

## 5. Maskot Detektif `<ScopeMascot />`
- Ilustrasi vektor berlapis **2.5D/3D bervolume** (shading radial lembut, pencahayaan rim, topi detektif ungu lembut, kacamata bulat mengilap, dan kaca pembesar—tanpa garis wireframe kaku).
- **3 Mood Reaktif:** `calm`, `alert`, dan `strategist` sesuai kondisi perubahan ruang lingkup proyek aktif.

---

## 6. Standar Copywriting Bahasa Indonesia
- Hangat, lugas, profesional, dan bebas dari terjemahan kaku bahasa Inggris.
- **Dilarang muncul di UI:** kata *"Demo"*, *"Demo Mode"*, *"Reset Demo"*, *"Demo Client"*, *"Creep Mentah"*, *"UNCHANGED"*, *"ADDITIONAL"*, atau footer promosi teknis palsu.
- Footer resmi: **`ScopeLens — Lindungi Kesepakatan & Margin Proyek Freelance`**.
