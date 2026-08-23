-- Overtime is now clock-based: crew clock in/out for an overtime session
-- (separate from their shift), with a reason at both ends and break tracking.
-- Hours are derived from the times minus break. The old free-form `reason`
-- and `hours` columns are kept — `reason` is folded into `reason_in`.
ALTER TABLE public.overtime_requests
  ADD COLUMN IF NOT EXISTS clock_in time,
  ADD COLUMN IF NOT EXISTS clock_out time,
  ADD COLUMN IF NOT EXISTS break_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS break_start time,
  ADD COLUMN IF NOT EXISTS breaks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reason_in text,
  ADD COLUMN IF NOT EXISTS reason_out text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

UPDATE public.overtime_requests
SET reason_in = reason
WHERE reason IS NOT NULL AND reason_in IS NULL;
