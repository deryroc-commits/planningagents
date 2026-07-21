
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'custom';

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS invite_code_viewer text,
  ADD COLUMN IF NOT EXISTS invite_code_admin  text,
  ADD COLUMN IF NOT EXISTS invite_code_custom text;

UPDATE public.workspaces SET invite_code_viewer = private.gen_unique_invite_code() WHERE invite_code_viewer IS NULL;
UPDATE public.workspaces SET invite_code_admin  = private.gen_unique_invite_code() WHERE invite_code_admin  IS NULL;
UPDATE public.workspaces SET invite_code_custom = private.gen_unique_invite_code() WHERE invite_code_custom IS NULL;

ALTER TABLE public.workspaces
  ALTER COLUMN invite_code_viewer SET NOT NULL,
  ALTER COLUMN invite_code_admin  SET NOT NULL,
  ALTER COLUMN invite_code_custom SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS workspaces_invite_code_viewer_key ON public.workspaces(invite_code_viewer);
CREATE UNIQUE INDEX IF NOT EXISTS workspaces_invite_code_admin_key  ON public.workspaces(invite_code_admin);
CREATE UNIQUE INDEX IF NOT EXISTS workspaces_invite_code_custom_key ON public.workspaces(invite_code_custom);

ALTER TABLE public.workspace_members
  ADD COLUMN IF NOT EXISTS tab_permissions jsonb;
