-- Effective-dated versions of payroll settings. The active version is the
-- latest one whose effective_date is on or before today.
CREATE TABLE IF NOT EXISTS public.payroll_settings_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_date date NOT NULL UNIQUE,
  cutoff_start_day int NOT NULL DEFAULT 21,
  cutoff_end_day int NOT NULL DEFAULT 20,
  payday int NOT NULL DEFAULT 27,
  daily_allowance_by_attendance boolean NOT NULL DEFAULT true,
  deduct_absence_from_salary boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payroll_settings_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "psv read authenticated" ON public.payroll_settings_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "psv write admin" ON public.payroll_settings_versions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Seed the first version from the current single-row settings (effective 1 Jan 2026).
INSERT INTO public.payroll_settings_versions
  (effective_date, cutoff_start_day, cutoff_end_day, payday, daily_allowance_by_attendance, deduct_absence_from_salary)
SELECT DATE '2026-01-01', cutoff_start_day, cutoff_end_day, payday, daily_allowance_by_attendance, deduct_absence_from_salary
FROM public.payroll_settings
WHERE NOT EXISTS (SELECT 1 FROM public.payroll_settings_versions);
