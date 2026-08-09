-- Payroll runs and the payslips they produce. A run covers one cutoff period
-- (identified by its end-month anchor); re-running replaces its payslips.
CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anchor_year int NOT NULL,
  anchor_month int NOT NULL, -- 0-based end month
  period_start date NOT NULL,
  period_end date NOT NULL,
  payday date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized')),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(anchor_year, anchor_month)
);
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pr read authenticated" ON public.payroll_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "pr write admin" ON public.payroll_runs FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE TABLE IF NOT EXISTS public.payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  working_days int NOT NULL DEFAULT 0,
  present_days int NOT NULL DEFAULT 0,
  absent_days int NOT NULL DEFAULT 0,
  day_off_days int NOT NULL DEFAULT 0,
  overtime_hours numeric NOT NULL DEFAULT 0,
  earnings_total numeric NOT NULL DEFAULT 0,
  deductions_total numeric NOT NULL DEFAULT 0,
  thp numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(run_id, employee_id)
);
CREATE INDEX IF NOT EXISTS payslips_employee_idx ON public.payslips(employee_id);
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps read authenticated" ON public.payslips FOR SELECT TO authenticated USING (true);
CREATE POLICY "ps write admin" ON public.payslips FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE TABLE IF NOT EXISTS public.payslip_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_id uuid NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('earning', 'deduction')),
  label text NOT NULL,
  detail text,
  amount numeric NOT NULL DEFAULT 0,
  sort int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS payslip_lines_payslip_idx ON public.payslip_lines(payslip_id);
ALTER TABLE public.payslip_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "psl read authenticated" ON public.payslip_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "psl write admin" ON public.payslip_lines FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
