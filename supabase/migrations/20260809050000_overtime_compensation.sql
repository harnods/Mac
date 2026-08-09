-- Overtime compensation, set per Job level, with effective-dated versions
-- (same versioning concept as payroll components).
CREATE TABLE IF NOT EXISTS public.overtime_compensations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  job_level_id uuid REFERENCES public.job_levels(id),
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.overtime_compensations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "otc read authenticated" ON public.overtime_compensations FOR SELECT TO authenticated USING (true);
CREATE POLICY "otc write admin" ON public.overtime_compensations FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE TABLE IF NOT EXISTS public.overtime_compensation_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compensation_id uuid NOT NULL REFERENCES public.overtime_compensations(id) ON DELETE CASCADE,
  effective_date date NOT NULL,
  amount_per_hour numeric NOT NULL DEFAULT 0,
  cap_hours boolean NOT NULL DEFAULT true,
  max_hours_per_day numeric NOT NULL DEFAULT 4.5,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(compensation_id, effective_date)
);
CREATE INDEX IF NOT EXISTS ocv_compensation_idx ON public.overtime_compensation_versions(compensation_id);
ALTER TABLE public.overtime_compensation_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ocv read authenticated" ON public.overtime_compensation_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "ocv write admin" ON public.overtime_compensation_versions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
