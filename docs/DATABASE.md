# Dokumentasi Database — ScopeLens (PostgreSQL)

File migrasi berada di:
- `supabase/migrations/202611160001_initial_schema.sql`
- `supabase/migrations/202611160002_rls_policies.sql`
- `supabase/migrations/202611160003_rpc_transactions.sql`
- `supabase/seed.sql`

## Daftar Tabel & Aturan Integritas

### 1. `public.profiles`
Menyimpan profil freelancer yang terhubung 1:1 dengan `auth.users`. Diisi otomatis oleh trigger `handle_new_user()`.

### 2. `public.projects`
- `initial_price` dan `hourly_rate` bertipe `BIGINT` (integer Rupiah, bebas error *floating-point*).
- `productive_hours_per_day` bertipe `NUMERIC(5,2)` dengan check `(> 0 AND <= 24)`.
- `work_days` bertipe `INTEGER[]` (default `{1,2,3,4,5}` untuk Senin–Jumat).
- `holidays` bertipe `DATE[]` untuk hari libur khusus proyek.
- Constraint `projects_deadline_valid`: memastikan `original_deadline >= start_date`.

### 3. `public.scope_items`
- `item_type`: `'original'` (baseline kontrak) atau `'requested'` (permintaan perubahan).
- `original_item_id`: UUID nullable yang mereferensikan item baseline saat `item_type = 'requested'`.
- Constraint `scope_items_original_baseline_rule`: mencegah item `'original'` merujuk item lain.
- Constraint `scope_items_no_self_ref`: mencegah self-reference.
- Aturan aplikasi: `original_item_id IS NULL` pada `'requested'` selalu dianalisis sebagai `'added'`, tidak pernah dianggap modifikasi berdasarkan kemiripan nama saja.

### 4. `public.negotiations` & `public.negotiation_items`
Menyimpan histori simulasi negosiasi (`accept_changes`, `scope_swap`, `phase_2`) dan aksi tiap item (`include`, `exclude`, `swap`, `defer`).

### 5. `public.project_reports`
Menyimpan snapshot JSONB (`report_data`) yang bersifat *immutable* sebagai bukti Change Order kepada klien.

## Keamanan Row Level Security (RLS)
Semua 6 tabel mengaktifkan `ENABLE ROW LEVEL SECURITY`. Tidak ada akses anonim ke data proyek pengguna lain. Pengujian isolasi lintas-pengguna tersedia di `src/__tests__/integrationSupabase.test.ts`.
