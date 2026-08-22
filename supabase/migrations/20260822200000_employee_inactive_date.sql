-- Effective date a crew became inactive. After this date they drop off the
-- schedule. Cleared when they're marked active again.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS inactive_date date;
