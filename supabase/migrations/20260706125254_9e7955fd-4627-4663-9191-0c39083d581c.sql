CREATE TABLE public.planning_cloud_state (
  id text PRIMARY KEY DEFAULT 'main',
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planning_cloud_state_singleton CHECK (id = 'main')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_cloud_state TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_cloud_state TO authenticated;
GRANT ALL ON public.planning_cloud_state TO service_role;

ALTER TABLE public.planning_cloud_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone using the app can read the shared planning"
ON public.planning_cloud_state
FOR SELECT
TO anon, authenticated
USING (id = 'main');

CREATE POLICY "Anyone using the app can create the shared planning"
ON public.planning_cloud_state
FOR INSERT
TO anon, authenticated
WITH CHECK (id = 'main');

CREATE POLICY "Anyone using the app can update the shared planning"
ON public.planning_cloud_state
FOR UPDATE
TO anon, authenticated
USING (id = 'main')
WITH CHECK (id = 'main');

CREATE POLICY "Anyone using the app can delete the shared planning"
ON public.planning_cloud_state
FOR DELETE
TO anon, authenticated
USING (id = 'main');

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_planning_cloud_state_updated_at
BEFORE UPDATE ON public.planning_cloud_state
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();