-- Recruitment is now driven by job positions directly (no job_openings). Every
-- job position (except CEO) is always open; candidates link to a position.
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS job_position_id uuid REFERENCES public.job_positions(id) ON DELETE SET NULL;

-- Backfill from the legacy opening's position, then loosen opening_id.
UPDATE public.candidates c
  SET job_position_id = o.job_position_id
  FROM public.job_openings o
  WHERE c.opening_id = o.id AND c.job_position_id IS NULL;

ALTER TABLE public.candidates ALTER COLUMN opening_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS candidates_job_position_idx ON public.candidates(job_position_id);
