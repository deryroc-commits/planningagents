CREATE OR REPLACE FUNCTION private.can_edit_workspace(_workspace uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.workspace_id = _workspace AND m.user_id = _user
      AND m.status = 'active'
      AND (
        m.role IN ('owner','editor','admin')
        OR (
          m.role = 'custom'
          AND EXISTS (
            SELECT 1
            FROM jsonb_each_text(COALESCE(m.tab_permissions, '{}'::jsonb)) AS p(k, v)
            WHERE v = 'edit'
          )
        )
      )
  );
$$;