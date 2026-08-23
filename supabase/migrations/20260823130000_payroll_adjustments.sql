-- One-time payroll components per crew per period (bonus, uniform deposit, …),
-- added before a run. Period-scoped so they persist across re-runs and are
-- included when the run computes payslips.
CREATE TABLE IF NOT EXISTS public.payroll_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anchor_year int NOT NULL,
  anchor_month int NOT NULL,  -- 0-11
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  label text NOT NULL,
  type text NOT NULL CHECK (type IN ('earning','deduction')),
  amount numeric NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payroll_adjustments_period_idx ON public.payroll_adjustments (anchor_year, anchor_month);
ALTER TABLE public.payroll_adjustments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "payroll_adjustments read" ON public.payroll_adjustments FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "payroll_adjustments write" ON public.payroll_adjustments FOR ALL TO authenticated USING (public.is_admin() OR public.has_permission('employees:write')) WITH CHECK (public.is_admin() OR public.has_permission('employees:write')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
