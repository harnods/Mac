-- App access is independent of role: a login can reach the back office, the crew
-- app, both, or neither. Backfill mirrors the previous role-based behavior.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS access_backoffice boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_crew boolean NOT NULL DEFAULT false;

UPDATE public.profiles SET access_crew = true,  access_backoffice = false WHERE role = 'crew';
UPDATE public.profiles SET access_backoffice = true, access_crew = false WHERE role <> 'crew';
