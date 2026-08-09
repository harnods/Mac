-- Effective-dated versions of a payroll component's amount/rate.
CREATE TABLE IF NOT EXISTS public.payroll_component_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id uuid NOT NULL REFERENCES public.allowances(id) ON DELETE CASCADE,
  effective_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  rate_unit text NOT NULL DEFAULT 'month' CHECK (rate_unit IN ('day', 'week', 'month')),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(component_id, effective_date)
);
CREATE INDEX IF NOT EXISTS pcv_component_idx ON public.payroll_component_versions(component_id);
ALTER TABLE public.payroll_component_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pcv read authenticated" ON public.payroll_component_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "pcv write admin" ON public.payroll_component_versions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Seed one starting version per existing component (effective 1 Jan 2026).
INSERT INTO public.payroll_component_versions (component_id, effective_date, amount, rate_unit)
SELECT a.id, DATE '2026-01-01', 0, CASE WHEN a.is_default THEN 'day' ELSE 'month' END
FROM public.allowances a
WHERE NOT EXISTS (SELECT 1 FROM public.payroll_component_versions v WHERE v.component_id = a.id);
