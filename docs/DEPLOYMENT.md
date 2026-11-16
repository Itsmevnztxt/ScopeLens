# Panduan Deployment & Migrasi VPS — ScopeLens v2.0

Arsitektur ScopeLens sengaja dibangun di atas PostgreSQL standar + Supabase agar dapat dimulai gratis di **Supabase Cloud** lalu dipindahkan ke **VPS Linux (Docker + Caddy HTTPS)** tanpa mengubah logika bisnis frontend.

---

## Tahap 1: Supabase Cloud Free + Static Hosting (Vercel / Netlify / Firebase Hosting)

1. Buat project baru di Supabase Cloud.
2. Jalankan file SQL dari `supabase/migrations/` secara berurutan di SQL Editor (atau via Supabase CLI `supabase db push`):
   - `202611160001_initial_schema.sql`
   - `202611160002_rls_policies.sql`
   - `202611160003_rpc_transactions.sql`
   - `202611160004_roles_and_realtime.sql`
3. Salin `Project URL` dan `anon public key` dari Settings → API ke `.env.local`:
   ```env
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
   *(Jangan pernah menaruh `service_role` key atau password DB di frontend.)*
4. Jalankan `npm run build` dan deploy folder `dist/` ke Vercel / Netlify / Firebase Hosting.

---

## Tahap 2: Migrasi ke VPS Linux (Docker Compose + Caddy HTTPS)

File siap pakai tersedia di folder `docker/`:
- `docker/docker-compose.yml`
- `docker/.env.selfhosted.example`
- `docker/Caddyfile`

### Langkah Migrasi Lengkap (Bukan Sekadar Ganti URL):

1. **Siapkan VPS & Build Frontend**
   - Pastikan VPS memiliki minimal 2 vCPU, 2 GB RAM, dan firewall (`ufw`) hanya membuka port `22`, `80`, dan `443`.
   - Build frontend dengan `VITE_SUPABASE_URL=https://scopelens.domainanda.com` dan `VITE_SUPABASE_ANON_KEY=<anon-jwt-dari-jwt-secret>`.
2. **Konfigurasi Environment & Secrets**
   - Salin `docker/.env.selfhosted.example` menjadi `docker/.env`.
   - Isi `POSTGRES_PASSWORD`, `JWT_SECRET` (minimal 32 karakter acak), `DOMAIN`, `PUBLIC_URL`, dan kredensial `SMTP_*` untuk verifikasi email & reset kata sandi.
3. **Jalankan Stack Docker**
   ```bash
   cd docker
   docker compose up -d
   ```
   Caddy otomatis menerbitkan sertifikat SSL/TLS Let's Encrypt untuk HTTPS pada domain Anda.
4. **Migrasi Data & Auth Users dari Supabase Cloud**
   - Ekspor skema & data (termasuk schema `auth` dan `public`) menggunakan `pg_dump`:
     ```bash
     pg_dump "$CLOUD_DB_URL" --schema=auth --schema=public --data-only --column-inserts > backup_data.sql
     ```
   - Restore ke kontainer PostgreSQL VPS setelah migrasi skema selesai:
     ```bash
     docker exec -i scopelens-db psql -U postgres -d postgres < backup_data.sql
     ```
   - Pastikan `GOTRUE_SITE_URL` dan `GOTRUE_URI_ALLOW_LIST` diperbarui ke domain baru agar redirect login/reset password valid.
5. **Strategi Backup & Pemulihan Produksi**
   - Jadwalkan `cron` harian pada VPS:
     ```bash
     0 2 * * * docker exec scopelens-db pg_dump -U postgres -Fc postgres > /backups/scopelens_$(date +\%F).dump
     ```
   - Simpan salinan terenkripsi di object storage terpisah (S3/R2/Backblaze) dan uji restore berkala ke database staging.
