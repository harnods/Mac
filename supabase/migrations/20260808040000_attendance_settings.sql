-- Global attendance rules: grace periods that decide Late / Early leave.
CREATE TABLE IF NOT EXISTS public.attendance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  late_grace_minutes int NOT NULL DEFAULT 15,
  early_leave_grace_minutes int NOT NULL DEFAULT 15,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_settings read authenticated" ON public.attendance_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "attendance_settings write admin" ON public.attendance_settings FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Single settings row.
INSERT INTO public.attendance_settings (late_grace_minutes, early_leave_grace_minutes)
SELECT 15, 15
WHERE NOT EXISTS (SELECT 1 FROM public.attendance_settings);
