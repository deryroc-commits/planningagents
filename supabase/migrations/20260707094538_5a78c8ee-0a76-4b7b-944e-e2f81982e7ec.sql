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

grant execute on function public.get_shared_planning(text, int) to anon, authenticated;