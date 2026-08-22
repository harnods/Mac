-- Crew can be marked Inactive (temporarily not working) without resigning.
-- Inactive is distinct from resigned (which is driven by termination_date).
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
