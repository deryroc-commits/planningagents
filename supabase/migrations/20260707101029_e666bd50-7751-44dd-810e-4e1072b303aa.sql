
-- Least-privilege execute grants on internal (private) functions.
revoke all on function private.is_workspace_member(uuid, uuid) from public;
grant execute on function private.is_workspace_member(uuid, uuid) to authenticated;

revoke all on function private.can_edit_workspace(uuid, uuid) from public;
grant execute on function private.can_edit_workspace(uuid, uuid) to authenticated;

revoke all on function private.has_workspace_role(uuid, uuid, public.app_role) from public;
grant execute on function private.has_workspace_role(uuid, uuid, public.app_role) to authenticated;

revoke all on function private.shares_workspace(uuid, uuid) from public;
grant execute on function private.shares_workspace(uuid, uuid) to authenticated;

-- Only ever called from within other SECURITY DEFINER functions (as owner).
revoke all on function private.gen_unique_invite_code() from public;

-- RPC implementations are invoked by the public SECURITY INVOKER wrappers,
-- so the calling role needs EXECUTE. Public share planning is anon-callable
-- by design (token-gated); the rest require an authenticated session.
revoke all on function private.get_shared_planning(text, integer) from public;
grant execute on function private.get_shared_planning(text, integer) to anon, authenticated;

revoke all on function private.create_workspace(text) from public;
grant execute on function private.create_workspace(text) to authenticated;

revoke all on function private.join_workspace(text) from public;
grant execute on function private.join_workspace(text) to authenticated;

revoke all on function private.regenerate_invite_code(uuid) from public;
grant execute on function private.regenerate_invite_code(uuid) to authenticated;
