DROP TABLE IF EXISTS public.planning_cloud_state;

CREATE POLICY "Users create workspace they own" ON public.workspaces
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());