-- ScopeLens v2.0 — Atomic PostgreSQL RPC Functions
-- Menggunakan SECURITY INVOKER agar RLS selalu aktif saat dipanggil client.

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
  v_negotiation_id UUID;
  v_item JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: user not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.projects WHERE id = p_project_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Project not found or access denied';
  END IF;

  -- Nonaktifkan negosiasi aktif sebelumnya agar histori tetap tersimpan
  UPDATE public.negotiations
  SET is_active = FALSE
  WHERE project_id = p_project_id AND user_id = v_user_id AND is_active = TRUE;

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
    v_user_id,
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
    -- Pastikan scope_item_id memang milik p_project_id agar tidak dapat menautkan item milik user lain
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

-- Transaksi atomik menyimpan seluruh workspace (project + scope_items + active negotiation)
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
  v_neg_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: user not authenticated';
  END IF;

  v_project_id := NULLIF(p_project ->> 'id', '')::UUID;

  IF v_project_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.projects WHERE id = v_project_id AND user_id = v_user_id
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
      work_days = ARRAY(SELECT jsonb_array_elements_text(p_project -> 'work_days')::INTEGER),
      holidays = ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_project -> 'holidays', '[]'::jsonb))::DATE),
      currency = COALESCE(p_project ->> 'currency', 'IDR'),
      status = COALESCE(p_project ->> 'status', 'active')
    WHERE id = v_project_id AND user_id = v_user_id;
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
      ARRAY(SELECT jsonb_array_elements_text(p_project -> 'work_days')::INTEGER),
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_project -> 'holidays', '[]'::jsonb))::DATE),
      COALESCE(p_project ->> 'currency', 'IDR'),
      COALESCE(p_project ->> 'status', 'active')
    )
    RETURNING id INTO v_project_id;
  END IF;

  -- Upsert original items terlebih dahulu agar FK original_item_id valid
  FOR v_item IN
    SELECT * FROM jsonb_array_elements(COALESCE(p_scope_items, '[]'::jsonb))
    WHERE value ->> 'item_type' = 'original'
  LOOP
    v_item_id := COALESCE(NULLIF(v_item ->> 'id', '')::UUID, gen_random_uuid());
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

  -- Upsert requested items
  FOR v_item IN
    SELECT * FROM jsonb_array_elements(COALESCE(p_scope_items, '[]'::jsonb))
    WHERE value ->> 'item_type' = 'requested'
  LOOP
    v_item_id := COALESCE(NULLIF(v_item ->> 'id', '')::UUID, gen_random_uuid());
    v_keep_ids := array_append(v_keep_ids, v_item_id);

    INSERT INTO public.scope_items (
      id, project_id, original_item_id, item_name, description,
      quantity, estimated_hours, revision_limit, priority, category,
      item_type, status, sort_order
    )
    VALUES (
      v_item_id,
      v_project_id,
      NULLIF(v_item ->> 'original_item_id', '')::UUID,
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

  -- Hapus item yang tidak lagi ada di payload
  DELETE FROM public.scope_items
  WHERE project_id = v_project_id
    AND NOT (id = ANY(v_keep_ids));

  -- Simpan simulasi negosiasi jika disertakan
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
