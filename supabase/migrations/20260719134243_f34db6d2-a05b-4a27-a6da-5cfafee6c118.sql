
-- 1) Extend status to allow 'blocked'
ALTER TABLE public.workspace_members DROP CONSTRAINT workspace_members_status_check;
ALTER TABLE public.workspace_members ADD CONSTRAINT workspace_members_status_check
  CHECK (status = ANY (ARRAY['active','pending','blocked']));

-- 2) Email blocklist per workspace
CREATE TABLE public.workspace_email_blocklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  UNIQUE (workspace_id, email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_email_blocklist TO authenticated;
GRANT ALL ON public.workspace_email_blocklist TO service_role;
ALTER TABLE public.workspace_email_blocklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads blocklist" ON public.workspace_email_blocklist
  FOR SELECT TO authenticated
  USING (private.has_workspace_role(workspace_id, auth.uid(), 'owner'));
CREATE POLICY "Owner inserts blocklist" ON public.workspace_email_blocklist
  FOR INSERT TO authenticated
  WITH CHECK (private.has_workspace_role(workspace_id, auth.uid(), 'owner'));
CREATE POLICY "Owner deletes blocklist" ON public.workspace_email_blocklist
  FOR DELETE TO authenticated
  USING (private.has_workspace_role(workspace_id, auth.uid(), 'owner'));

-- 3) Access log per workspace
CREATE TABLE public.workspace_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_email text,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.workspace_access_log TO authenticated;
GRANT ALL ON public.workspace_access_log TO service_role;
ALTER TABLE public.workspace_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads log" ON public.workspace_access_log
  FOR SELECT TO authenticated
  USING (private.has_workspace_role(workspace_id, auth.uid(), 'owner'));
CREATE POLICY "Owner writes log" ON public.workspace_access_log
  FOR INSERT TO authenticated
  WITH CHECK (private.has_workspace_role(workspace_id, auth.uid(), 'owner'));

CREATE INDEX workspace_access_log_ws_time_idx
  ON public.workspace_access_log (workspace_id, created_at DESC);

-- 4) join_workspace: reject blocked emails and blocked members
CREATE OR REPLACE FUNCTION private.join_workspace(_code text)
RETURNS public.workspaces
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  ws public.workspaces;
  my_email text;
  existing_status text;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;

  select email into my_email from auth.users where id = auth.uid();

  select * into ws from public.workspaces where invite_code = trim(_code);
  if ws.id is null then
    raise exception 'Code invalide';
  end if;

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
  values (ws.id, auth.uid(), 'editor', 'pending')
  on conflict (workspace_id, user_id) do nothing;

  return ws;
end;
$function$;
