-- Track when a finalized payroll run's payslips were sent to crew.
ALTER TABLE public.payroll_runs ADD COLUMN IF NOT EXISTS sent_at timestamptz;
