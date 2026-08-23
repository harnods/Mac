-- Optional formula on a payroll component version: an amount computed at
-- payroll-run time as formula_rate × <attendance variable>, e.g. late deduction
-- = 30000 × late_days. Effective-dated via the version's effective_date.
-- formula_basis is one of: late_days, missing_clock_in_days, missing_clock_out_days,
-- incomplete_days, absent_days, present_days, working_days, overtime_hours.
ALTER TABLE public.payroll_component_versions
  ADD COLUMN IF NOT EXISTS formula_basis text,
  ADD COLUMN IF NOT EXISTS formula_rate numeric;
