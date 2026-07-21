
CREATE OR REPLACE FUNCTION private.can_admin_workspace(_workspace uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1 from public.workspace_members
     where workspace_id = _workspace
       and user_id = _user
       and status = 'active'
       and role::text in ('owner','admin')
  );
$$;

DROP POLICY IF EXISTS "Owner manages members" ON public.workspace_members;
CREATE POLICY "Admins manage members" ON public.workspace_members
  FOR UPDATE
  USING (private.can_admin_workspace(workspace_id, auth.uid()))
  WITH CHECK (private.can_admin_workspace(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Owner or self removes membership" ON public.workspace_members;
CREATE POLICY "Admins or self remove membership" ON public.workspace_members
  FOR DELETE
  USING (private.can_admin_workspace(workspace_id, auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Owner reads blocklist"   ON public.workspace_email_blocklist;
DROP POLICY IF EXISTS "Owner inserts blocklist" ON public.workspace_email_blocklist;
DROP POLICY IF EXISTS "Owner deletes blocklist" ON public.workspace_email_blocklist;
CREATE POLICY "Admins read blocklist"   ON public.workspace_email_blocklist FOR SELECT USING (private.can_admin_workspace(workspace_id, auth.uid()));
CREATE POLICY "Admins insert blocklist" ON public.workspace_email_blocklist FOR INSERT WITH CHECK (private.can_admin_workspace(workspace_id, auth.uid()));
CREATE POLICY "Admins delete blocklist" ON public.workspace_email_blocklist FOR DELETE USING (private.can_admin_workspace(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Owner updates workspace" ON public.workspaces;
CREATE POLICY "Admins update workspace" ON public.workspaces
  FOR UPDATE
  USING (private.can_admin_workspace(id, auth.uid()))
  WITH CHECK (private.can_admin_workspace(id, auth.uid()));

CREATE OR REPLACE FUNCTION private.create_workspace(_name text)
RETURNS public.workspaces
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  ws public.workspaces;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;

  insert into public.workspaces (name, invite_code, invite_code_viewer, invite_code_admin, invite_code_custom, owner_id)
  values (
    coalesce(nullif(trim(_name), ''), 'Mon équipe'),
    private.gen_unique_invite_code(),
    private.gen_unique_invite_code(),
    private.gen_unique_invite_code(),
    private.gen_unique_invite_code(),
    auth.uid()
  )
  returning * into ws;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (ws.id, auth.uid(), 'owner'::public.app_role, 'active');

  return ws;
end;
$function$;

CREATE OR REPLACE FUNCTION private.join_workspace(_code text)
RETURNS public.workspaces
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  ws public.workspaces;
  my_email text;
  existing_status text;
  matched_role public.app_role;
  cleaned text := trim(_code);
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;

  select email into my_email from auth.users where id = auth.uid();

  select * into ws from public.workspaces
   where invite_code = cleaned
      or invite_code_viewer = cleaned
      or invite_code_admin  = cleaned
      or invite_code_custom = cleaned;

  if ws.id is null then
    raise exception 'Code invalide';
  end if;

  matched_role := case
    when ws.invite_code_viewer = cleaned then 'viewer'::public.app_role
    when ws.invite_code_admin  = cleaned then 'admin'::public.app_role
    when ws.invite_code_custom = cleaned then 'custom'::public.app_role
    else 'editor'::public.app_role
  end;

  if my_email is not null and exists (
    select 1 from public.workspace_email_blocklist
     where workspace_id = ws.id and lower(email) = lower(my_email)
  ) then
    raise exception 'Accès refusé par l''administrateur';
  end if;

  select status into existing_status from public.workspace_members
   where workspace_id = ws.id and user_id = auth.uid();

  if existing_status = 'blocked' then
    raise exception 'Accès refusé par l''administrateur';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (ws.id, auth.uid(), matched_role, 'pending')
  on conflict (workspace_id, user_id) do nothing;

  return ws;
end;
$function$;

DROP FUNCTION IF EXISTS public.regenerate_invite_code(uuid);
DROP FUNCTION IF EXISTS private.regenerate_invite_code(uuid);

CREATE OR REPLACE FUNCTION private.regenerate_invite_code(_workspace uuid, _level text default 'editor')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  new_code text;
begin
  if not private.can_admin_workspace(_workspace, auth.uid()) then
    raise exception 'Réservé aux administrateurs';
  end if;
  new_code := private.gen_unique_invite_code();
  case _level
    when 'viewer' then update public.workspaces set invite_code_viewer = new_code where id = _workspace;
    when 'admin'  then update public.workspaces set invite_code_admin  = new_code where id = _workspace;
    when 'custom' then update public.workspaces set invite_code_custom = new_code where id = _workspace;
    else               update public.workspaces set invite_code        = new_code where id = _workspace;
  end case;
  return new_code;
end;
$function$;

CREATE OR REPLACE FUNCTION public.regenerate_invite_code(_workspace uuid, _level text default 'editor')
RETURNS text
LANGUAGE sql
SET search_path = public
AS $function$
  select private.regenerate_invite_code(_workspace, _level);
$function$;
