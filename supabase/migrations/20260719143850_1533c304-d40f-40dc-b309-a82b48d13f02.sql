CREATE OR REPLACE FUNCTION private.create_workspace(_name text)
 RETURNS public.workspaces
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ws public.workspaces;
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;

  insert into public.workspaces (name, invite_code, owner_id)
  values (coalesce(nullif(trim(_name), ''), 'Mon équipe'), private.gen_unique_invite_code(), auth.uid())
  returning * into ws;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (ws.id, auth.uid(), 'owner', 'active');

  -- Planning volontairement vide : chaque nouveau workspace démarre de zéro,
  -- indépendant des autres. Aucune donnée existante n'est copiée.
  return ws;
end;
$function$;