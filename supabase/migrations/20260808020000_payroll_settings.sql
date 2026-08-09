-- Payroll settings (singleton): monthly cutoff window + payday.
CREATE TABLE IF NOT EXISTS public.payroll_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cutoff_start_day int NOT NULL DEFAULT 21,
  cutoff_end_day int NOT NULL DEFAULT 20,
  payday int NOT NULL DEFAULT 27,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payroll_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll_settings read authenticated" ON public.payroll_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "payroll_settings write admin" ON public.payroll_settings FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Seed the single settings row with defaults (21st–20th cutoff, pay on the 27th).
INSERT INTO public.payroll_settings (cutoff_start_day, cutoff_end_day, payday)
SELECT 21, 20, 27
WHERE NOT EXISTS (SELECT 1 FROM public.payroll_settings);
