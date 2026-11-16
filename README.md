# ScopeLens v2.0

**Detect. Compare. Calculate. Negotiate.**  
Decision Support System (DSS) Anti-Scope Creep untuk Freelancer & Penyedia Jasa — Target Kompetisi **ISCOMFEST 2026**.

---

## Fitur Utama
1. **Interactive Split-Screen Studio:** Bandingkan *Original Scope (Baseline Terkunci)* di sisi kiri dengan *New Requests & Modifikasi* di sisi kanan secara langsung.
2. **Business Logic Engine Presisi (`src/engine/`):**
   - **Scope Analyzer:** Deteksi `UNCHANGED`, `ADDITIONAL`, `MODIFIED`, `REMOVED`, `SWAPPED`, dan `PHASE 2` berbasis ID unik & relasi `originalItemId` (tanpa double counting).
   - **Cost Calculator:** Aritmetika Rupiah integer berbasis milli-hours (bebas *floating-point drift*).
   - **Deadline Calculator:** Perhitungan pergeseran tanggal selesai berdasarkan hari kerja aktif, akhir pekan, dan hari libur khusus.
   - **Negotiation Engine:** Simulasi 3 strategi (*Accept Changes*, *Scope Swap*, *Phase 2*) + generator pesan WhatsApp & Email Profesional berbahasa Indonesia.
3. **Maskot Detektif Reaktif ("Lensy"):** Inline SVG 100% *offline-safe* dengan 3 ekspresi dinamis (`calm`, `alert`, `strategist`).
4. **Ekspor A4 & Snapshot Permanen:** Cetak layout A4, unduh PDF (`jspdf`), atau simpan snapshot JSONB.
5. **Demo Mode Instan + Supabase Cloud / Self-Hosted Ready:** Langsung dapat dicoba tanpa login (`Website Company Profile`), atau hubungkan ke PostgreSQL + Supabase Auth + Row Level Security.

---

## Menjalankan Secara Lokal

```bash
npm install
npm run dev
```

Buka browser di `http://localhost:5173`.

### Pengujian & Build
```bash
npm run lint     # TypeScript typecheck
npm test         # Menjalankan unit & integration tests (Vitest)
npm run build    # Production build
```

---

## Struktur Direktori
- `DESIGN.md` — Design system *Cozy Pastel Studio*
- `src/engine/` — Modul kalkulasi bisnis murni (teruji unit test)
- `src/services/` — Service layer Supabase (`auth`, `project`, `scope`, `negotiation`, `report`)
- `src/stores/` — Zustand store dengan `localStorage` fallback
- `src/components/` — Antarmuka React + Tailwind + Recharts + Native `<dialog>`
- `supabase/migrations/` — Skema PostgreSQL, RLS policies, dan RPC transaksi atomik
- `docker/` — Paket migrasi VPS (Docker Compose + PostgreSQL + GoTrue + PostgREST + Caddy)
- `docs/` — Dokumentasi Arsitektur (`ARCHITECTURE.md`), Database (`DATABASE.md`), API (`API.md`), dan Deployment (`DEPLOYMENT.md`)
