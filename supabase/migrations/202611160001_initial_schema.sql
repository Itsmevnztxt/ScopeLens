-- ScopeLens v2.0 — Initial PostgreSQL Schema
-- Kompatibel dengan Supabase Cloud & Supabase Self-Hosted (PostgreSQL 15+)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Helper trigger function untuk updated_at otomatis
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- A. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile saat user mendaftar via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.email, '')
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- B. PROJECTS
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL CHECK (char_length(trim(project_name)) > 0),
  client_name TEXT NOT NULL CHECK (char_length(trim(client_name)) > 0),
  project_category TEXT NOT NULL DEFAULT 'Web Development',
  project_description TEXT NOT NULL DEFAULT '',
  start_date DATE NOT NULL,
  original_deadline DATE NOT NULL,
  initial_price BIGINT NOT NULL CHECK (initial_price >= 0),
  hourly_rate BIGINT NOT NULL CHECK (hourly_rate > 0),
  productive_hours_per_day NUMERIC(5,2) NOT NULL DEFAULT 6 CHECK (productive_hours_per_day > 0 AND productive_hours_per_day <= 24),
  work_days INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
  holidays DATE[] NOT NULL DEFAULT '{}',
  currency TEXT NOT NULL DEFAULT 'IDR',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT projects_deadline_valid CHECK (original_deadline >= start_date),
  CONSTRAINT projects_work_days_valid CHECK (array_length(work_days, 1) >= 1)
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at DESC);

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- C. SCOPE ITEMS
CREATE TABLE IF NOT EXISTS public.scope_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  original_item_id UUID NULL REFERENCES public.scope_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL CHECK (char_length(trim(item_name)) > 0),
  description TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  estimated_hours NUMERIC(8,2) NOT NULL CHECK (estimated_hours >= 0),
  revision_limit INTEGER NOT NULL DEFAULT 2 CHECK (revision_limit >= 0),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  category TEXT NOT NULL DEFAULT 'Feature',
  item_type TEXT NOT NULL CHECK (item_type IN ('original', 'requested')),
  status TEXT NOT NULL DEFAULT 'unchanged' CHECK (status IN ('unchanged', 'added', 'modified', 'removed', 'deferred', 'swapped')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT scope_items_no_self_ref CHECK (original_item_id IS NULL OR original_item_id <> id),
  CONSTRAINT scope_items_original_baseline_rule CHECK (NOT (item_type = 'original' AND original_item_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_scope_items_project_type ON public.scope_items(project_id, item_type);
CREATE INDEX IF NOT EXISTS idx_scope_items_original_ref ON public.scope_items(original_item_id);

CREATE TRIGGER trg_scope_items_updated_at
  BEFORE UPDATE ON public.scope_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- D. NEGOTIATIONS
CREATE TABLE IF NOT EXISTS public.negotiations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy TEXT NOT NULL CHECK (strategy IN ('accept_changes', 'scope_swap', 'phase_2')),
  additional_cost BIGINT NOT NULL,
  additional_hours NUMERIC(8,2) NOT NULL,
  revised_price BIGINT NOT NULL CHECK (revised_price >= 0),
  revised_deadline DATE NOT NULL,
  negotiation_notes TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_negotiations_project_id ON public.negotiations(project_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_user_id ON public.negotiations(user_id);

CREATE TRIGGER trg_negotiations_updated_at
  BEFORE UPDATE ON public.negotiations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- E. NEGOTIATION ITEMS
CREATE TABLE IF NOT EXISTS public.negotiation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negotiation_id UUID NOT NULL REFERENCES public.negotiations(id) ON DELETE CASCADE,
  scope_item_id UUID NOT NULL REFERENCES public.scope_items(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('include', 'exclude', 'swap', 'defer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_negotiation_scope_item UNIQUE (negotiation_id, scope_item_id)
);

CREATE INDEX IF NOT EXISTS idx_negotiation_items_neg_id ON public.negotiation_items(negotiation_id);

-- F. PROJECT REPORTS (Immutable JSONB Snapshot)
CREATE TABLE IF NOT EXISTS public.project_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  negotiation_id UUID NULL REFERENCES public.negotiations(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_title TEXT NOT NULL CHECK (char_length(trim(report_title)) > 0),
  report_data JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_reports_project_id ON public.project_reports(project_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_reports_user_id ON public.project_reports(user_id);
