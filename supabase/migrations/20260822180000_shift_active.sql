-- Shifts can be marked Active/Inactive. Inactive shifts stay on historical
-- attendance but are hidden from the crew clock-in picker in me.machimoto.
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
