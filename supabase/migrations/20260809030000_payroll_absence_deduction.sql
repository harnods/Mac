-- When on, days the crew is absent (not a Day off) are deducted from basic
-- salary: basic_salary / working_days_in_period * absent_days.
ALTER TABLE public.payroll_settings
  ADD COLUMN IF NOT EXISTS deduct_absence_from_salary boolean NOT NULL DEFAULT false;
