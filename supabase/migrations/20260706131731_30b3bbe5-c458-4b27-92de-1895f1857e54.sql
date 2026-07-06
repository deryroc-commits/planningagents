
revoke execute on function public.is_workspace_member(uuid, uuid) from anon, public;
revoke execute on function public.has_workspace_role(uuid, uuid, public.app_role) from anon, public;
revoke execute on function public.can_edit_workspace(uuid, uuid) from anon, public;
revoke execute on function public.shares_workspace(uuid, uuid) from anon, public;
revoke execute on function public.gen_unique_invite_code() from anon, public;
revoke execute on function public.create_workspace(text) from anon, public;
revoke execute on function public.join_workspace(text) from anon, public;
revoke execute on function public.regenerate_invite_code(uuid) from anon, public;

grant execute on function public.is_workspace_member(uuid, uuid) to authenticated;
grant execute on function public.has_workspace_role(uuid, uuid, public.app_role) to authenticated;
grant execute on function public.can_edit_workspace(uuid, uuid) to authenticated;
grant execute on function public.shares_workspace(uuid, uuid) to authenticated;
grant execute on function public.create_workspace(text) to authenticated;
grant execute on function public.join_workspace(text) to authenticated;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;
