-- Optional physical requirements per job opening (not every position needs them),
-- gated by a toggle, plus the candidate's self-reported height/weight.
ALTER TABLE public.job_openings
  ADD COLUMN IF NOT EXISTS require_physical boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_height_cm numeric,
  ADD COLUMN IF NOT EXISTS min_weight_kg numeric;

ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS height_cm numeric,
  ADD COLUMN IF NOT EXISTS weight_kg numeric;
