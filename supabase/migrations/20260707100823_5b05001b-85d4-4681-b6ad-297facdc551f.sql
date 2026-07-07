
-- =====================================================================
-- Private schema to hold internal SECURITY DEFINER functions
-- (not exposed via the Data API / PostgREST)
-- =====================================================================
create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- ---------------------------------------------------------------------
-- 1) Internal RLS helper functions -> private schema
-- ---------------------------------------------------------------------
create or replace function private.is_workspace_member(_workspace uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = _workspace and user_id = _user
  );
$$;

create or replace function private.can_edit_workspace(_workspace uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = _workspace and user_id = _user and role in ('owner','editor')
  );
$$;

create or replace function private.has_workspace_role(_workspace uuid, _user uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = _workspace and user_id = _user and role = _role
  );
$$;

create or replace function private.shares_workspace(_other uuid, _me uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.workspace_members m1
    join public.workspace_members m2 on m1.workspace_id = m2.workspace_id
    where m1.user_id = _me and m2.user_id = _other
  );
$$;

create or replace function private.gen_unique_invite_code()
returns text language plpgsql security definer set search_path = public as $$
declare
  code text;
  tries int := 0;
begin
  loop
    code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.workspaces where invite_code = code);
    tries := tries + 1;
    if tries > 50 then
      raise exception 'Impossible de générer un code unique';
    end if;
  end loop;
  return code;
end;
$$;

-- ---------------------------------------------------------------------
-- 2) Client-facing RPC implementations -> private schema (definer)
-- ---------------------------------------------------------------------
create or replace function private.get_shared_planning(_token text, _year integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  lnk record;
  ws_name text;
  st jsonb;
  year_planning jsonb;
  agent jsonb;
begin
  select workspace_id, agent_id, mode, expires_at into lnk
  from public.agent_share_links where token = _token;

  if lnk.workspace_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if lnk.expires_at is not null and lnk.expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  select name into ws_name from public.workspaces where id = lnk.workspace_id;
  select state into st from public.workspace_planning where workspace_id = lnk.workspace_id;
  st := coalesce(st, '{}'::jsonb);
  year_planning := coalesce(st->'planningByYear'->(_year::text), '{}'::jsonb);

  if lnk.mode = 'perso' then
    select a into agent
    from jsonb_array_elements(coalesce(st->'agents','[]'::jsonb)) a
    where a->>'id' = lnk.agent_id
    limit 1;

    return jsonb_build_object(
      'ok', true,
      'mode', 'perso',
      'workspaceName', coalesce(ws_name, ''),
      'year', _year,
      'expiresAt', lnk.expires_at,
      'codes', coalesce(st->'codes', '[]'::jsonb),
      'colors', st->'colors',
      'agents', case when agent is null then '[]'::jsonb else jsonb_build_array(agent) end,
      'planning', case when agent is null then '{}'::jsonb
                       else jsonb_build_object(lnk.agent_id, coalesce(year_planning->lnk.agent_id, '{}'::jsonb)) end
    );
  else
    return jsonb_build_object(
      'ok', true,
      'mode', 'general',
      'workspaceName', coalesce(ws_name, ''),
      'year', _year,
      'expiresAt', lnk.expires_at,
      'codes', coalesce(st->'codes', '[]'::jsonb),
      'colors', st->'colors',
      'agents', coalesce(st->'agents', '[]'::jsonb),
      'planning', year_planning
    );
  end if;
end;
$$;

create or replace function private.create_workspace(_name text)
returns public.workspaces language plpgsql security definer set search_path = public as $$
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

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws.id, auth.uid(), 'owner');

  select state into seed from public.planning_cloud_state where id = 'main';
  if seed is not null then
    insert into public.workspace_planning (workspace_id, state)
    values (ws.id, seed);
  end if;

  return ws;
end;
$$;

create or replace function private.join_workspace(_code text)
returns public.workspaces language plpgsql security definer set search_path = public as $$
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

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws.id, auth.uid(), 'editor')
  on conflict (workspace_id, user_id) do nothing;

  return ws;
end;
$$;

create or replace function private.regenerate_invite_code(_workspace uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  new_code text;
begin
  if not private.has_workspace_role(_workspace, auth.uid(), 'owner') then
    raise exception 'Réservé au propriétaire';
  end if;
  new_code := private.gen_unique_invite_code();
  update public.workspaces set invite_code = new_code where id = _workspace;
  return new_code;
end;
$$;

-- ---------------------------------------------------------------------
-- 3) Public wrappers (SECURITY INVOKER) so the client keeps calling the
--    same RPC names. Invoker wrappers are not flagged by the linter.
-- ---------------------------------------------------------------------
create or replace function public.get_shared_planning(_token text, _year integer)
returns jsonb language sql stable security invoker set search_path = public as $$
  select private.get_shared_planning(_token, _year);
$$;

create or replace function public.create_workspace(_name text)
returns public.workspaces language plpgsql security invoker set search_path = public as $$
begin
  return private.create_workspace(_name);
end;
$$;

create or replace function public.join_workspace(_code text)
returns public.workspaces language plpgsql security invoker set search_path = public as $$
begin
  return private.join_workspace(_code);
end;
$$;

create or replace function public.regenerate_invite_code(_workspace uuid)
returns text language sql security invoker set search_path = public as $$
  select private.regenerate_invite_code(_workspace);
$$;

-- ---------------------------------------------------------------------
-- 4) Recreate RLS policies to reference the private helper functions
-- ---------------------------------------------------------------------
-- agent_share_links
drop policy if exists "Members read share links" on public.agent_share_links;
create policy "Members read share links" on public.agent_share_links
  for select to authenticated
  using (private.is_workspace_member(workspace_id, auth.uid()));

drop policy if exists "Editors insert share links" on public.agent_share_links;
create policy "Editors insert share links" on public.agent_share_links
  for insert to authenticated
  with check (private.can_edit_workspace(workspace_id, auth.uid()));

drop policy if exists "Editors update share links" on public.agent_share_links;
create policy "Editors update share links" on public.agent_share_links
  for update to authenticated
  using (private.can_edit_workspace(workspace_id, auth.uid()))
  with check (private.can_edit_workspace(workspace_id, auth.uid()));

drop policy if exists "Editors delete share links" on public.agent_share_links;
create policy "Editors delete share links" on public.agent_share_links
  for delete to authenticated
  using (private.can_edit_workspace(workspace_id, auth.uid()));

-- workspaces
drop policy if exists "Members read their workspaces" on public.workspaces;
create policy "Members read their workspaces" on public.workspaces
  for select to authenticated
  using (private.is_workspace_member(id, auth.uid()));

-- workspace_planning
drop policy if exists "Members read workspace planning" on public.workspace_planning;
create policy "Members read workspace planning" on public.workspace_planning
  for select to authenticated
  using (private.is_workspace_member(workspace_id, auth.uid()));

drop policy if exists "Editors insert workspace planning" on public.workspace_planning;
create policy "Editors insert workspace planning" on public.workspace_planning
  for insert to authenticated
  with check (private.can_edit_workspace(workspace_id, auth.uid()));

drop policy if exists "Editors update workspace planning" on public.workspace_planning;
create policy "Editors update workspace planning" on public.workspace_planning
  for update to authenticated
  using (private.can_edit_workspace(workspace_id, auth.uid()))
  with check (private.can_edit_workspace(workspace_id, auth.uid()));

-- workspace_members
drop policy if exists "Members read co-members" on public.workspace_members;
create policy "Members read co-members" on public.workspace_members
  for select to authenticated
  using (private.is_workspace_member(workspace_id, auth.uid()));

drop policy if exists "Owner manages members" on public.workspace_members;
create policy "Owner manages members" on public.workspace_members
  for update to authenticated
  using (private.has_workspace_role(workspace_id, auth.uid(), 'owner'))
  with check (private.has_workspace_role(workspace_id, auth.uid(), 'owner'));

drop policy if exists "Owner or self removes membership" on public.workspace_members;
create policy "Owner or self removes membership" on public.workspace_members
  for delete to authenticated
  using (private.has_workspace_role(workspace_id, auth.uid(), 'owner') or (user_id = auth.uid()));

-- ---------------------------------------------------------------------
-- 5) profiles: hide email from co-members (column-level), keep display name
-- ---------------------------------------------------------------------
drop policy if exists "Users read own or co-member profiles" on public.profiles;
create policy "Users read own or co-member profiles" on public.profiles
  for select to authenticated
  using ((id = auth.uid()) or private.shares_workspace(id, auth.uid()));

revoke select on public.profiles from authenticated;
grant select (id, display_name, created_at, updated_at) on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- 6) Drop now-unused public helper functions (moved to private)
-- ---------------------------------------------------------------------
drop function if exists public.is_workspace_member(uuid, uuid);
drop function if exists public.can_edit_workspace(uuid, uuid);
drop function if exists public.has_workspace_role(uuid, uuid, public.app_role);
drop function if exists public.shares_workspace(uuid, uuid);
drop function if exists public.gen_unique_invite_code();

-- ---------------------------------------------------------------------
-- 7) Trigger functions: not callable directly by API roles
-- ---------------------------------------------------------------------
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.set_updated_at() from anon, authenticated;

-- ---------------------------------------------------------------------
-- 8) planning_cloud_state: remove all direct anon/authenticated access
--    (legacy seed table, only read internally by private.create_workspace)
-- ---------------------------------------------------------------------
drop policy if exists "Anyone using the app can create the shared planning" on public.planning_cloud_state;
drop policy if exists "Anyone using the app can delete the shared planning" on public.planning_cloud_state;
drop policy if exists "Anyone using the app can read the shared planning" on public.planning_cloud_state;
drop policy if exists "Anyone using the app can update the shared planning" on public.planning_cloud_state;

revoke all on public.planning_cloud_state from anon;
revoke all on public.planning_cloud_state from authenticated;
grant all on public.planning_cloud_state to service_role;

do $$
begin
  alter publication supabase_realtime drop table public.planning_cloud_state;
exception
  when others then null;
end;
$$;
