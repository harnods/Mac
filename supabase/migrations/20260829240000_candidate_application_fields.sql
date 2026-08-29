-- Full job-application fields (single global apply form). Weight is dropped
-- from the flow; height stays.
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS birth_place text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS domicile text,
  ADD COLUMN IF NOT EXISTS maps_link text,
  ADD COLUMN IF NOT EXISTS fresh_graduate boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS work_experiences jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS employment_status text,   -- 'working' | 'not_working'
  ADD COLUMN IF NOT EXISTS notice_period text,
  ADD COLUMN IF NOT EXISTS earliest_join text,
  ADD COLUMN IF NOT EXISTS agree_terms boolean,
  ADD COLUMN IF NOT EXISTS agree_interview boolean;
