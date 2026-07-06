
-- ============ ENUM ROLE ============
create type public.app_role as enum ('owner', 'editor', 'viewer');

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- ============ WORKSPACES ============
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.workspaces to authenticated;
grant all on public.workspaces to service_role;
alter table public.workspaces enable row level security;

-- ============ WORKSPACE MEMBERS ============
create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'editor',
  joined_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
grant select, insert, update, delete on public.workspace_members to authenticated;
grant all on public.workspace_members to service_role;
alter table public.workspace_members enable row level security;

-- ============ WORKSPACE PLANNING ============
create table public.workspace_planning (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.workspace_planning to authenticated;
grant all on public.workspace_planning to service_role;
alter table public.workspace_planning enable row level security;

-- ============ SECURITY DEFINER HELPERS ============
create or replace function public.is_workspace_member(_workspace uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = _workspace and user_id = _user
  );
$$;

create or replace function public.has_workspace_role(_workspace uuid, _user uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = _workspace and user_id = _user and role = _role
  );
$$;

create or replace function public.can_edit_workspace(_workspace uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = _workspace and user_id = _user and role in ('owner','editor')
  );
$$;

create or replace function public.shares_workspace(_other uuid, _me uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.workspace_members m1
    join public.workspace_members m2 on m1.workspace_id = m2.workspace_id
    where m1.user_id = _me and m2.user_id = _other
  );
$$;

-- ============ PROFILES POLICIES ============
create policy "Users read own or co-member profiles"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_workspace(id, auth.uid()));
create policy "Users insert own profile"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy "Users update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ============ WORKSPACES POLICIES ============
create policy "Members read their workspaces"
  on public.workspaces for select to authenticated
  using (public.is_workspace_member(id, auth.uid()));
create policy "Owner updates workspace"
  on public.workspaces for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Owner deletes workspace"
  on public.workspaces for delete to authenticated
  using (owner_id = auth.uid());

-- ============ WORKSPACE MEMBERS POLICIES ============
create policy "Members read co-members"
  on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id, auth.uid()));
create policy "Owner manages members"
  on public.workspace_members for update to authenticated
  using (public.has_workspace_role(workspace_id, auth.uid(), 'owner'))
  with check (public.has_workspace_role(workspace_id, auth.uid(), 'owner'));
create policy "Owner or self removes membership"
  on public.workspace_members for delete to authenticated
  using (public.has_workspace_role(workspace_id, auth.uid(), 'owner') or user_id = auth.uid());

-- ============ WORKSPACE PLANNING POLICIES ============
create policy "Members read workspace planning"
  on public.workspace_planning for select to authenticated
  using (public.is_workspace_member(workspace_id, auth.uid()));
create policy "Editors insert workspace planning"
  on public.workspace_planning for insert to authenticated
  with check (public.can_edit_workspace(workspace_id, auth.uid()));
create policy "Editors update workspace planning"
  on public.workspace_planning for update to authenticated
  using (public.can_edit_workspace(workspace_id, auth.uid()))
  with check (public.can_edit_workspace(workspace_id, auth.uid()));

-- ============ PROFILE AUTO-CREATE TRIGGER ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ UPDATED_AT TRIGGERS ============
create trigger set_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_workspaces_updated_at before update on public.workspaces
  for each row execute function public.set_updated_at();
create trigger set_workspace_planning_updated_at before update on public.workspace_planning
  for each row execute function public.set_updated_at();

-- ============ INVITE CODE + WORKSPACE RPCs ============
create or replace function public.gen_unique_invite_code()
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

create or replace function public.create_workspace(_name text)
returns public.workspaces language plpgsql security definer set search_path = public as $$
declare
  ws public.workspaces;
  seed jsonb;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;

  insert into public.workspaces (name, invite_code, owner_id)
  values (coalesce(nullif(trim(_name), ''), 'Mon équipe'), public.gen_unique_invite_code(), auth.uid())
  returning * into ws;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws.id, auth.uid(), 'owner');

  -- Reprend le planning partagé existant comme point de départ (sans rien perdre).
  select state into seed from public.planning_cloud_state where id = 'main';
  if seed is not null then
    insert into public.workspace_planning (workspace_id, state)
    values (ws.id, seed);
  end if;

  return ws;
end;
$$;

create or replace function public.join_workspace(_code text)
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

create or replace function public.regenerate_invite_code(_workspace uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  new_code text;
begin
  if not public.has_workspace_role(_workspace, auth.uid(), 'owner') then
    raise exception 'Réservé au propriétaire';
  end if;
  new_code := public.gen_unique_invite_code();
  update public.workspaces set invite_code = new_code where id = _workspace;
  return new_code;
end;
$$;

-- ============ REALTIME ============
alter table public.workspace_planning replica identity full;
alter table public.workspace_members replica identity full;
alter publication supabase_realtime add table public.workspace_planning;
alter publication supabase_realtime add table public.workspace_members;
