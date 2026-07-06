-- Liens de partage QR par agent
create table public.agent_share_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id text not null,
  token text not null unique,
  mode text not null default 'perso',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, agent_id),
  constraint agent_share_links_mode_check check (mode in ('perso','general'))
);

grant select, insert, update, delete on public.agent_share_links to authenticated;
grant all on public.agent_share_links to service_role;

alter table public.agent_share_links enable row level security;

create policy "Members read share links"
  on public.agent_share_links for select to authenticated
  using (public.is_workspace_member(workspace_id, auth.uid()));

create policy "Editors insert share links"
  on public.agent_share_links for insert to authenticated
  with check (public.can_edit_workspace(workspace_id, auth.uid()));

create policy "Editors update share links"
  on public.agent_share_links for update to authenticated
  using (public.can_edit_workspace(workspace_id, auth.uid()))
  with check (public.can_edit_workspace(workspace_id, auth.uid()));

create policy "Editors delete share links"
  on public.agent_share_links for delete to authenticated
  using (public.can_edit_workspace(workspace_id, auth.uid()));

create trigger set_agent_share_links_updated_at
  before update on public.agent_share_links
  for each row execute function public.set_updated_at();

-- Lecture publique (via QR) d'un planning, limitée au périmètre du lien.
create or replace function public.get_shared_planning(_token text, _year int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  lnk record;
  ws_name text;
  st jsonb;
  year_planning jsonb;
  agent jsonb;
begin
  select workspace_id, agent_id, mode into lnk
  from public.agent_share_links where token = _token;

  if lnk.workspace_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
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
      'codes', coalesce(st->'codes', '[]'::jsonb),
      'colors', st->'colors',
      'agents', coalesce(st->'agents', '[]'::jsonb),
      'planning', year_planning
    );
  end if;
end;
$$;

grant execute on function public.get_shared_planning(text, int) to anon, authenticated;