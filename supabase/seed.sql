-- ScopeLens v2.0 — Demo Seed SQL (untuk local Supabase / psql)
-- Catatan: Demo mode di frontend berjalan instan tanpa akun, sedangkan script ini
-- dapat dipakai untuk mengisi proyek contoh bagi user demo yang sudah dibuat di auth.users.

DO $$
DECLARE
  v_demo_user_id UUID;
  v_project_id UUID := '11111111-1111-4111-8111-111111111111';
  v_item_landing UUID := '22222222-2222-4222-8222-222222222201';
  v_item_contact UUID := '22222222-2222-4222-8222-222222222202';
  v_item_resp UUID := '22222222-2222-4222-8222-222222222203';
BEGIN
  SELECT id INTO v_demo_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;

  IF v_demo_user_id IS NULL THEN
    RAISE NOTICE 'Belum ada user di auth.users; lewati seed SQL.';
    RETURN;
  END IF;

  INSERT INTO public.projects (
    id, user_id, project_name, client_name, project_category, project_description,
    start_date, original_deadline, initial_price, hourly_rate,
    productive_hours_per_day, work_days, holidays, currency, status
  )
  VALUES (
    v_project_id,
    v_demo_user_id,
    'Website Company Profile',
    'Demo Client',
    'Web Development',
    'Pembuatan website company profile responsif dengan halaman utama dan formulir kontak.',
    '2026-11-16',
    '2026-11-23',
    1500000,
    75000,
    6,
    '{1,2,3,4,5}',
    '{}',
    'IDR',
    'active'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.scope_items (
    id, project_id, original_item_id, item_name, description, quantity, estimated_hours,
    revision_limit, priority, category, item_type, status, sort_order
  )
  VALUES
    (v_item_landing, v_project_id, NULL, 'Landing Page', 'Halaman utama company profile dengan hero, layanan, dan portofolio.', 1, 8, 2, 'high', 'Frontend', 'original', 'unchanged', 1),
    (v_item_contact, v_project_id, NULL, 'Contact Form', 'Formulir kontak terintegrasi validasi dan notifikasi email.', 1, 4, 2, 'medium', 'Backend', 'original', 'unchanged', 2),
    (v_item_resp, v_project_id, NULL, 'Responsive Design', 'Penyesuaian tampilan desktop, tablet, dan mobile.', 1, 8, 2, 'high', 'UI/UX', 'original', 'unchanged', 3),
    ('33333333-3333-4333-8333-333333333301', v_project_id, NULL, 'Dashboard Admin', 'Panel admin untuk mengelola konten artikel dan inquiry klien.', 1, 5, 2, 'high', 'Fullstack', 'requested', 'added', 1),
    ('33333333-3333-4333-8333-333333333302', v_project_id, NULL, 'User Login', 'Sistem autentikasi login dan proteksi halaman admin.', 1, 4, 1, 'medium', 'Auth', 'requested', 'added', 2),
    ('33333333-3333-4333-8333-333333333303', v_project_id, NULL, 'Additional Pages', 'Penambahan 3 halaman profil tim, karier, dan FAQ.', 1, 3, 2, 'low', 'Frontend', 'requested', 'added', 3)
  ON CONFLICT (id) DO NOTHING;
END $$;
