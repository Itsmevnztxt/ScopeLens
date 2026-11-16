-- ScopeLens v2.0 — Role-Based Access Control (Admin & User) + Supabase Realtime
-- Menambahkan kolom role pada profiles, RLS anti-eskalasi privilege, RPC admin, dan publikasi Realtime.

-- 1. Kolom role pada public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'user'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 2. Helper SECURITY DEFINER untuk memeriksa role tanpa infinite recursion di RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_profile_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_profile_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_profile_role() TO authenticated;

-- 3. Pastikan pendaftaran baru SELALU mendapat role 'user' (abaikan metadata role dari client)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.email, ''),
    'user'
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = CASE
          WHEN public.profiles.full_name = '' THEN EXCLUDED.full_name
          ELSE public.profiles.full_name
        END;
  RETURN NEW;
END;
$$;

-- 4. Trigger proteksi perubahan role pada public.profiles (anti self-escalation & anti-hapus admin terakhir)
CREATE OR REPLACE FUNCTION public.protect_profile_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining_admins INTEGER;
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Jika dipanggil dari sesi API pengguna (bukan SQL Editor / migration superuser)
    IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Forbidden: hanya admin yang dapat mengubah role pengguna.';
    END IF;

    -- Cegah penurunan role admin terakhir (dengan row lock anti-race condition)
    IF OLD.role = 'admin' AND NEW.role <> 'admin' THEN
      PERFORM 1
      FROM public.profiles
      WHERE role = 'admin'
      FOR UPDATE;

      SELECT count(*) INTO v_remaining_admins
      FROM public.profiles
      WHERE role = 'admin' AND id <> OLD.id;

      IF v_remaining_admins = 0 THEN
        RAISE EXCEPTION 'Cannot demote the last remaining administrator.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role_change();

-- 5. Perbarui RLS Policies untuk mendukung User (isolasi data sendiri) & Admin (pengelolaan platform)

-- A. PROFILES
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING ((SELECT auth.uid()) = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = id AND role = 'user');

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING ((SELECT auth.uid()) = id)
  WITH CHECK (
    (SELECT auth.uid()) = id
    AND role = COALESCE(public.get_my_profile_role(), 'user')
  );

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- B. PROJECTS
DROP POLICY IF EXISTS "projects_select_own" ON public.projects;
CREATE POLICY "projects_select_own"
  ON public.projects FOR SELECT
  USING ((SELECT auth.uid()) = user_id OR public.is_admin());

DROP POLICY IF EXISTS "projects_update_own" ON public.projects;
CREATE POLICY "projects_update_own"
  ON public.projects FOR UPDATE
  USING ((SELECT auth.uid()) = user_id OR public.is_admin())
  WITH CHECK ((SELECT auth.uid()) = user_id OR public.is_admin());

DROP POLICY IF EXISTS "projects_delete_own" ON public.projects;
CREATE POLICY "projects_delete_own"
  ON public.projects FOR DELETE
  USING ((SELECT auth.uid()) = user_id OR public.is_admin());

-- C. SCOPE ITEMS
DROP POLICY IF EXISTS "scope_items_select_own" ON public.scope_items;
CREATE POLICY "scope_items_select_own"
  ON public.scope_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = scope_items.project_id
        AND (p.user_id = (SELECT auth.uid()) OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "scope_items_insert_own" ON public.scope_items;
CREATE POLICY "scope_items_insert_own"
  ON public.scope_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = scope_items.project_id
        AND (p.user_id = (SELECT auth.uid()) OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "scope_items_update_own" ON public.scope_items;
CREATE POLICY "scope_items_update_own"
  ON public.scope_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = scope_items.project_id
        AND (p.user_id = (SELECT auth.uid()) OR public.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = scope_items.project_id
        AND (p.user_id = (SELECT auth.uid()) OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "scope_items_delete_own" ON public.scope_items;
CREATE POLICY "scope_items_delete_own"
  ON public.scope_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = scope_items.project_id
        AND (p.user_id = (SELECT auth.uid()) OR public.is_admin())
    )
  );

-- D. NEGOTIATIONS (terikat kepemilikan project atau admin agar kolaborasi admin-user sinkron)
DROP POLICY IF EXISTS "negotiations_select_own" ON public.negotiations;
CREATE POLICY "negotiations_select_own"
  ON public.negotiations FOR SELECT
  USING (
    (SELECT auth.uid()) = user_id
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = negotiations.project_id
        AND p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "negotiations_insert_own" ON public.negotiations;
CREATE POLICY "negotiations_insert_own"
  ON public.negotiations FOR INSERT
  WITH CHECK (
    ((SELECT auth.uid()) = user_id OR public.is_admin())
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = negotiations.project_id
        AND (p.user_id = (SELECT auth.uid()) OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "negotiations_update_own" ON public.negotiations;
CREATE POLICY "negotiations_update_own"
  ON public.negotiations FOR UPDATE
  USING (
    (SELECT auth.uid()) = user_id
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = negotiations.project_id
        AND p.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    ((SELECT auth.uid()) = user_id OR public.is_admin() OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = negotiations.project_id
        AND p.user_id = (SELECT auth.uid())
    ))
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = negotiations.project_id
        AND (p.user_id = (SELECT auth.uid()) OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "negotiations_delete_own" ON public.negotiations;
CREATE POLICY "negotiations_delete_own"
  ON public.negotiations FOR DELETE
  USING (
    (SELECT auth.uid()) = user_id
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = negotiations.project_id
        AND p.user_id = (SELECT auth.uid())
    )
  );

-- E. NEGOTIATION ITEMS
DROP POLICY IF EXISTS "negotiation_items_select_own" ON public.negotiation_items;
CREATE POLICY "negotiation_items_select_own"
  ON public.negotiation_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.negotiations n
      JOIN public.projects p ON p.id = n.project_id
      WHERE n.id = negotiation_items.negotiation_id
        AND (n.user_id = (SELECT auth.uid()) OR p.user_id = (SELECT auth.uid()) OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "negotiation_items_insert_own" ON public.negotiation_items;
CREATE POLICY "negotiation_items_insert_own"
  ON public.negotiation_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.negotiations n
      JOIN public.projects p ON p.id = n.project_id
      WHERE n.id = negotiation_items.negotiation_id
        AND (n.user_id = (SELECT auth.uid()) OR p.user_id = (SELECT auth.uid()) OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "negotiation_items_update_own" ON public.negotiation_items;
CREATE POLICY "negotiation_items_update_own"
  ON public.negotiation_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.negotiations n
      JOIN public.projects p ON p.id = n.project_id
      WHERE n.id = negotiation_items.negotiation_id
        AND (n.user_id = (SELECT auth.uid()) OR p.user_id = (SELECT auth.uid()) OR public.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.negotiations n
      JOIN public.projects p ON p.id = n.project_id
      WHERE n.id = negotiation_items.negotiation_id
        AND (n.user_id = (SELECT auth.uid()) OR p.user_id = (SELECT auth.uid()) OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "negotiation_items_delete_own" ON public.negotiation_items;
CREATE POLICY "negotiation_items_delete_own"
  ON public.negotiation_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.negotiations n
      JOIN public.projects p ON p.id = n.project_id
      WHERE n.id = negotiation_items.negotiation_id
        AND (n.user_id = (SELECT auth.uid()) OR p.user_id = (SELECT auth.uid()) OR public.is_admin())
    )
  );

-- F. PROJECT REPORTS
DROP POLICY IF EXISTS "project_reports_select_own" ON public.project_reports;
CREATE POLICY "project_reports_select_own"
  ON public.project_reports FOR SELECT
  USING (
    (SELECT auth.uid()) = user_id
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_reports.project_id
        AND p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "project_reports_insert_own" ON public.project_reports;
CREATE POLICY "project_reports_insert_own"
  ON public.project_reports FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_reports.project_id
        AND (p.user_id = (SELECT auth.uid()) OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "project_reports_delete_own" ON public.project_reports;
CREATE POLICY "project_reports_delete_own"
  ON public.project_reports FOR DELETE
  USING (
    (SELECT auth.uid()) = user_id
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_reports.project_id
        AND p.user_id = (SELECT auth.uid())
    )
  );

-- 6. RPC Khusus Admin: mengubah role user secara aman
CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  p_target_user_id UUID,
  p_new_role TEXT
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_updated public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: user not authenticated';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: hanya admin yang dapat mengubah role pengguna.';
  END IF;

  IF p_new_role NOT IN ('admin', 'user') THEN
    RAISE EXCEPTION 'Role tidak valid. Gunakan admin atau user.';
  END IF;

  UPDATE public.profiles
  SET role = p_new_role
  WHERE id = p_target_user_id
  RETURNING * INTO v_updated;

  IF v_updated.id IS NULL THEN
    RAISE EXCEPTION 'Profil pengguna tidak ditemukan.';
  END IF;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_role(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, TEXT) TO authenticated;

-- 7. Perbarui RPC agar Admin dapat membantu mengelola proyek tanpa mengambil alih kepemilikan user_id
CREATE OR REPLACE FUNCTION public.save_negotiation_with_items(
  p_project_id UUID,
  p_strategy TEXT,
  p_additional_cost BIGINT,
  p_additional_hours NUMERIC,
  p_revised_price BIGINT,
  p_revised_deadline DATE,
  p_negotiation_notes TEXT,
  p_items JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_project_owner_id UUID;
  v_negotiation_id UUID;
  v_item JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: user not authenticated';
  END IF;

  SELECT user_id INTO v_project_owner_id
  FROM public.projects
  WHERE id = p_project_id
    AND (user_id = v_user_id OR public.is_admin());

  IF v_project_owner_id IS NULL THEN
    RAISE EXCEPTION 'Project not found or access denied';
  END IF;

  UPDATE public.negotiations
  SET is_active = FALSE
  WHERE project_id = p_project_id AND is_active = TRUE;

  INSERT INTO public.negotiations (
    project_id,
    user_id,
    strategy,
    additional_cost,
    additional_hours,
    revised_price,
    revised_deadline,
    negotiation_notes,
    is_active
  )
  VALUES (
    p_project_id,
    v_project_owner_id,
    p_strategy,
    p_additional_cost,
    p_additional_hours,
    p_revised_price,
    p_revised_deadline,
    COALESCE(p_negotiation_notes, ''),
    TRUE
  )
  RETURNING id INTO v_negotiation_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.scope_items
      WHERE id = (v_item ->> 'scope_item_id')::UUID
        AND project_id = p_project_id
    ) THEN
      RAISE EXCEPTION 'Invalid scope_item_id for project';
    END IF;

    INSERT INTO public.negotiation_items (negotiation_id, scope_item_id, action)
    VALUES (
      v_negotiation_id,
      (v_item ->> 'scope_item_id')::UUID,
      v_item ->> 'action'
    )
    ON CONFLICT (negotiation_id, scope_item_id) DO UPDATE
      SET action = EXCLUDED.action;
  END LOOP;

  RETURN v_negotiation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_project_workspace(
  p_project JSONB,
  p_scope_items JSONB,
  p_negotiation JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_project_id UUID;
  v_item JSONB;
  v_keep_ids UUID[] := ARRAY[]::UUID[];
  v_item_id UUID;
  v_orig_ref UUID;
  v_neg_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: user not authenticated';
  END IF;

  v_project_id := NULLIF(p_project ->> 'id', '')::UUID;

  IF v_project_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = v_project_id
      AND (user_id = v_user_id OR public.is_admin())
  ) THEN
    UPDATE public.projects
    SET
      project_name = p_project ->> 'project_name',
      client_name = p_project ->> 'client_name',
      project_category = COALESCE(p_project ->> 'project_category', 'Web Development'),
      project_description = COALESCE(p_project ->> 'project_description', ''),
      start_date = (p_project ->> 'start_date')::DATE,
      original_deadline = (p_project ->> 'original_deadline')::DATE,
      initial_price = (p_project ->> 'initial_price')::BIGINT,
      hourly_rate = (p_project ->> 'hourly_rate')::BIGINT,
      productive_hours_per_day = (p_project ->> 'productive_hours_per_day')::NUMERIC,
      work_days = ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_project -> 'work_days', '[1,2,3,4,5]'::jsonb))::INTEGER),
      holidays = ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_project -> 'holidays', '[]'::jsonb))::DATE),
      currency = COALESCE(p_project ->> 'currency', 'IDR'),
      status = COALESCE(p_project ->> 'status', 'active')
    WHERE id = v_project_id
      AND (user_id = v_user_id OR public.is_admin());
  ELSE
    IF v_project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.projects WHERE id = v_project_id
    ) THEN
      RAISE EXCEPTION 'Project access denied';
    END IF;

    INSERT INTO public.projects (
      id,
      user_id,
      project_name,
      client_name,
      project_category,
      project_description,
      start_date,
      original_deadline,
      initial_price,
      hourly_rate,
      productive_hours_per_day,
      work_days,
      holidays,
      currency,
      status
    )
    VALUES (
      COALESCE(v_project_id, gen_random_uuid()),
      v_user_id,
      p_project ->> 'project_name',
      p_project ->> 'client_name',
      COALESCE(p_project ->> 'project_category', 'Web Development'),
      COALESCE(p_project ->> 'project_description', ''),
      (p_project ->> 'start_date')::DATE,
      (p_project ->> 'original_deadline')::DATE,
      (p_project ->> 'initial_price')::BIGINT,
      (p_project ->> 'hourly_rate')::BIGINT,
      (p_project ->> 'productive_hours_per_day')::NUMERIC,
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_project -> 'work_days', '[1,2,3,4,5]'::jsonb))::INTEGER),
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_project -> 'holidays', '[]'::jsonb))::DATE),
      COALESCE(p_project ->> 'currency', 'IDR'),
      COALESCE(p_project ->> 'status', 'active')
    )
    RETURNING id INTO v_project_id;
  END IF;

  FOR v_item IN
    SELECT * FROM jsonb_array_elements(COALESCE(p_scope_items, '[]'::jsonb))
    WHERE value ->> 'item_type' = 'original'
  LOOP
    v_item_id := COALESCE(NULLIF(v_item ->> 'id', '')::UUID, gen_random_uuid());

    IF EXISTS (
      SELECT 1 FROM public.scope_items
      WHERE id = v_item_id AND project_id <> v_project_id
    ) THEN
      RAISE EXCEPTION 'Scope item access denied';
    END IF;

    v_keep_ids := array_append(v_keep_ids, v_item_id);

    INSERT INTO public.scope_items (
      id, project_id, original_item_id, item_name, description,
      quantity, estimated_hours, revision_limit, priority, category,
      item_type, status, sort_order
    )
    VALUES (
      v_item_id,
      v_project_id,
      NULL,
      v_item ->> 'item_name',
      COALESCE(v_item ->> 'description', ''),
      COALESCE((v_item ->> 'quantity')::INTEGER, 1),
      (v_item ->> 'estimated_hours')::NUMERIC,
      COALESCE((v_item ->> 'revision_limit')::INTEGER, 2),
      COALESCE(v_item ->> 'priority', 'medium'),
      COALESCE(v_item ->> 'category', 'Feature'),
      'original',
      COALESCE(v_item ->> 'status', 'unchanged'),
      COALESCE((v_item ->> 'sort_order')::INTEGER, 0)
    )
    ON CONFLICT (id) DO UPDATE SET
      item_name = EXCLUDED.item_name,
      description = EXCLUDED.description,
      quantity = EXCLUDED.quantity,
      estimated_hours = EXCLUDED.estimated_hours,
      revision_limit = EXCLUDED.revision_limit,
      priority = EXCLUDED.priority,
      category = EXCLUDED.category,
      status = EXCLUDED.status,
      sort_order = EXCLUDED.sort_order
    WHERE public.scope_items.project_id = v_project_id;
  END LOOP;

  FOR v_item IN
    SELECT * FROM jsonb_array_elements(COALESCE(p_scope_items, '[]'::jsonb))
    WHERE value ->> 'item_type' = 'requested'
  LOOP
    v_item_id := COALESCE(NULLIF(v_item ->> 'id', '')::UUID, gen_random_uuid());

    IF EXISTS (
      SELECT 1 FROM public.scope_items
      WHERE id = v_item_id AND project_id <> v_project_id
    ) THEN
      RAISE EXCEPTION 'Scope item access denied';
    END IF;

    v_orig_ref := NULLIF(v_item ->> 'original_item_id', '')::UUID;
    IF v_orig_ref IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.scope_items
      WHERE id = v_orig_ref
        AND project_id = v_project_id
        AND item_type = 'original'
    ) THEN
      RAISE EXCEPTION 'Invalid original_item_id for project';
    END IF;

    v_keep_ids := array_append(v_keep_ids, v_item_id);

    INSERT INTO public.scope_items (
      id, project_id, original_item_id, item_name, description,
      quantity, estimated_hours, revision_limit, priority, category,
      item_type, status, sort_order
    )
    VALUES (
      v_item_id,
      v_project_id,
      v_orig_ref,
      v_item ->> 'item_name',
      COALESCE(v_item ->> 'description', ''),
      COALESCE((v_item ->> 'quantity')::INTEGER, 1),
      (v_item ->> 'estimated_hours')::NUMERIC,
      COALESCE((v_item ->> 'revision_limit')::INTEGER, 2),
      COALESCE(v_item ->> 'priority', 'medium'),
      COALESCE(v_item ->> 'category', 'Feature'),
      'requested',
      COALESCE(v_item ->> 'status', 'added'),
      COALESCE((v_item ->> 'sort_order')::INTEGER, 0)
    )
    ON CONFLICT (id) DO UPDATE SET
      original_item_id = EXCLUDED.original_item_id,
      item_name = EXCLUDED.item_name,
      description = EXCLUDED.description,
      quantity = EXCLUDED.quantity,
      estimated_hours = EXCLUDED.estimated_hours,
      revision_limit = EXCLUDED.revision_limit,
      priority = EXCLUDED.priority,
      category = EXCLUDED.category,
      status = EXCLUDED.status,
      sort_order = EXCLUDED.sort_order
    WHERE public.scope_items.project_id = v_project_id;
  END LOOP;

  DELETE FROM public.scope_items
  WHERE project_id = v_project_id
    AND NOT (id = ANY(v_keep_ids));

  IF p_negotiation IS NOT NULL THEN
    SELECT public.save_negotiation_with_items(
      v_project_id,
      p_negotiation ->> 'strategy',
      (p_negotiation ->> 'additional_cost')::BIGINT,
      (p_negotiation ->> 'additional_hours')::NUMERIC,
      (p_negotiation ->> 'revised_price')::BIGINT,
      (p_negotiation ->> 'revised_deadline')::DATE,
      COALESCE(p_negotiation ->> 'negotiation_notes', ''),
      COALESCE(p_negotiation -> 'items', '[]'::jsonb)
    ) INTO v_neg_id;
  END IF;

  RETURN v_project_id;
END;
$$;

-- 8. Aktifkan Supabase Realtime untuk sinkronisasi langsung (postgres_changes)
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.projects REPLICA IDENTITY FULL;
ALTER TABLE public.scope_items REPLICA IDENTITY FULL;
ALTER TABLE public.negotiations REPLICA IDENTITY FULL;
ALTER TABLE public.negotiation_items REPLICA IDENTITY FULL;
ALTER TABLE public.project_reports REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.scope_items;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.negotiations;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.negotiation_items;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.project_reports;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- Catatan Bootstrap Admin Pertama:
-- Setelah akun admin mendaftar melalui UI ScopeLens atau Supabase Auth,
-- jalankan perintah ini satu kali di Supabase SQL Editor:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'admin-anda@domain.com';
