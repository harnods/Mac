-- Audit log for manual per-day schedule edits (roster grid). Shift names are
-- snapshotted as text so the log survives shift renames/deletes.
CREATE TABLE IF NOT EXISTS public.schedule_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  from_shift text,
  to_shift text,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS schedule_logs_created_idx ON public.schedule_logs(created_at DESC);
ALTER TABLE public.schedule_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "sl read" ON public.schedule_logs FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "sl write" ON public.schedule_logs FOR ALL TO authenticated USING (public.is_admin() OR public.has_permission('employees:write')) WITH CHECK (public.is_admin() OR public.has_permission('employees:write')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
