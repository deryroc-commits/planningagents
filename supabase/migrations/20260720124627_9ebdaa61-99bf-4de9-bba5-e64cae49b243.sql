ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS main_title text NOT NULL DEFAULT 'Planning des agents',
  ADD COLUMN IF NOT EXISTS subtitle text NOT NULL DEFAULT 'Cuisine Centrale — UCPA',
  ADD COLUMN IF NOT EXISTS print_title text NOT NULL DEFAULT 'PLANNING AGENTS UCPA';