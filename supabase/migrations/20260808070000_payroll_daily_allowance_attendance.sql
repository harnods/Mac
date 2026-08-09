-- When true, the Daily allowance is only paid for days the crew actually
-- attended (has a clock-in). Absent days earn no daily allowance.
ALTER TABLE public.payroll_settings
  ADD COLUMN IF NOT EXISTS daily_allowance_by_attendance boolean NOT NULL DEFAULT true;
