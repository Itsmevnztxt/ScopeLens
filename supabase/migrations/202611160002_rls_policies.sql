-- ScopeLens v2.0 — Row Level Security (RLS) Policies
-- Setiap tabel sensitif dilindungi RLS di level PostgreSQL.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scope_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negotiations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negotiation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_reports ENABLE ROW LEVEL SECURITY;

-- 1. PROFILES
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- 2. PROJECTS
DROP POLICY IF EXISTS "projects_select_own" ON public.projects;
CREATE POLICY "projects_select_own"
  ON public.projects FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "projects_insert_own" ON public.projects;
CREATE POLICY "projects_insert_own"
  ON public.projects FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "projects_update_own" ON public.projects;
CREATE POLICY "projects_update_own"
  ON public.projects FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "projects_delete_own" ON public.projects;
CREATE POLICY "projects_delete_own"
  ON public.projects FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- 3. SCOPE ITEMS (terikat kepemilikan project)
DROP POLICY IF EXISTS "scope_items_select_own" ON public.scope_items;
CREATE POLICY "scope_items_select_own"
  ON public.scope_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = scope_items.project_id
        AND p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "scope_items_insert_own" ON public.scope_items;
CREATE POLICY "scope_items_insert_own"
  ON public.scope_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = scope_items.project_id
        AND p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "scope_items_update_own" ON public.scope_items;
CREATE POLICY "scope_items_update_own"
  ON public.scope_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = scope_items.project_id
        AND p.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = scope_items.project_id
        AND p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "scope_items_delete_own" ON public.scope_items;
CREATE POLICY "scope_items_delete_own"
  ON public.scope_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = scope_items.project_id
        AND p.user_id = (SELECT auth.uid())
    )
  );

-- 4. NEGOTIATIONS
DROP POLICY IF EXISTS "negotiations_select_own" ON public.negotiations;
CREATE POLICY "negotiations_select_own"
  ON public.negotiations FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "negotiations_insert_own" ON public.negotiations;
CREATE POLICY "negotiations_insert_own"
  ON public.negotiations FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = negotiations.project_id
        AND p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "negotiations_update_own" ON public.negotiations;
CREATE POLICY "negotiations_update_own"
  ON public.negotiations FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = negotiations.project_id
        AND p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "negotiations_delete_own" ON public.negotiations;
CREATE POLICY "negotiations_delete_own"
  ON public.negotiations FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- 5. NEGOTIATION ITEMS
DROP POLICY IF EXISTS "negotiation_items_select_own" ON public.negotiation_items;
CREATE POLICY "negotiation_items_select_own"
  ON public.negotiation_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.negotiations n
      WHERE n.id = negotiation_items.negotiation_id
        AND n.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "negotiation_items_insert_own" ON public.negotiation_items;
CREATE POLICY "negotiation_items_insert_own"
  ON public.negotiation_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.negotiations n
      WHERE n.id = negotiation_items.negotiation_id
        AND n.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "negotiation_items_update_own" ON public.negotiation_items;
CREATE POLICY "negotiation_items_update_own"
  ON public.negotiation_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.negotiations n
      WHERE n.id = negotiation_items.negotiation_id
        AND n.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.negotiations n
      WHERE n.id = negotiation_items.negotiation_id
        AND n.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "negotiation_items_delete_own" ON public.negotiation_items;
CREATE POLICY "negotiation_items_delete_own"
  ON public.negotiation_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.negotiations n
      WHERE n.id = negotiation_items.negotiation_id
        AND n.user_id = (SELECT auth.uid())
    )
  );

-- 6. PROJECT REPORTS
DROP POLICY IF EXISTS "project_reports_select_own" ON public.project_reports;
CREATE POLICY "project_reports_select_own"
  ON public.project_reports FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "project_reports_insert_own" ON public.project_reports;
CREATE POLICY "project_reports_insert_own"
  ON public.project_reports FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_reports.project_id
        AND p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "project_reports_delete_own" ON public.project_reports;
CREATE POLICY "project_reports_delete_own"
  ON public.project_reports FOR DELETE
  USING ((SELECT auth.uid()) = user_id);
