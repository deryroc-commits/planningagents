
ALTER TABLE public.workspace_members
  ADD COLUMN status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active','pending'));

UPDATE public.workspace_members SET status = 'active';

CREATE OR REPLACE FUNCTION private.is_workspace_member(_workspace uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace AND user_id = _user AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION private.can_edit_workspace(_workspace uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace AND user_id = _user
      AND status = 'active' AND role IN ('owner','editor')
  );
$$;

CREATE OR REPLACE FUNCTION private.has_workspace_role(_workspace uuid, _user uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace AND user_id = _user
      AND status = 'active' AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION private.join_workspace(_code text)
RETURNS public.workspaces LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  ws public.workspaces;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;

  select * into ws from public.workspaces where invite_code = trim(_code);
  if ws.id is null then
    raise exception 'Code invalide';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (ws.id, auth.uid(), 'editor', 'pending')
  on conflict (workspace_id, user_id) do nothing;

  return ws;
end;
$$;

CREATE OR REPLACE FUNCTION private.create_workspace(_name text)
RETURNS public.workspaces LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  ws public.workspaces;
  seed jsonb;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;

  insert into public.workspaces (name, invite_code, owner_id)
  values (coalesce(nullif(trim(_name), ''), 'Mon équipe'), private.gen_unique_invite_code(), auth.uid())
  returning * into ws;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (ws.id, auth.uid(), 'owner', 'active');

  select state into seed from public.planning_cloud_state where id = 'main';
  if seed is not null then
    insert into public.workspace_planning (workspace_id, state)
    values (ws.id, seed);
  end if;

  return ws;
end;
$$;

DROP POLICY IF EXISTS "Members read co-members" ON public.workspace_members;
CREATE POLICY "Members and self read"
ON public.workspace_members FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR private.is_workspace_member(workspace_id, auth.uid())
  OR private.has_workspace_role(workspace_id, auth.uid(), 'owner')
);

DROP POLICY IF EXISTS "Members read their workspaces" ON public.workspaces;
CREATE POLICY "Members and pending read their workspaces"
ON public.workspaces FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.workspace_id = workspaces.id AND m.user_id = auth.uid()
  )
);
