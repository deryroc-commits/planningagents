DROP POLICY IF EXISTS "Admins manage members" ON public.workspace_members;

CREATE POLICY "Admins manage members"
ON public.workspace_members
FOR UPDATE
TO authenticated
USING (
  private.can_admin_workspace(workspace_id, auth.uid())
  AND (
    role <> 'owner'::app_role
    OR private.has_workspace_role(workspace_id, auth.uid(), 'owner'::app_role)
  )
)
WITH CHECK (
  private.can_admin_workspace(workspace_id, auth.uid())
  AND (
    role <> 'owner'::app_role
    OR private.has_workspace_role(workspace_id, auth.uid(), 'owner'::app_role)
  )
);