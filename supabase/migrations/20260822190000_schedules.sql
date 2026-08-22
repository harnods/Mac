-- Crew schedule (planned shift per crew per day), separate from attendance
-- (actual clock-ins). One row per employee per day.
CREATE TABLE IF NOT EXISTS public.schedules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date   date NOT NULL,
  shift_id    uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  updated_by  uuid REFERENCES public.profiles(id),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, work_date)
);

CREATE INDEX IF NOT EXISTS schedules_emp_date_idx ON public.schedules (employee_id, work_date);

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedules read authenticated" ON public.schedules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "schedules write" ON public.schedules
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_permission('employees:write'))
  WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
