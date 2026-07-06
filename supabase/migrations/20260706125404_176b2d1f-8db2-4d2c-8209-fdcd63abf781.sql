DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'planning_cloud_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.planning_cloud_state;
  END IF;
END;
$$;