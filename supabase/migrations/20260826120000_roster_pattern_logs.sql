-- Track who last changed a schedule pattern and a per-change audit log.
ALTER TABLE public.roster_patterns
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;
UPDATE public.roster_patterns SET updated_at = created_at, updated_by = created_by WHERE updated_at IS NULL;

CREATE TABLE IF NOT EXISTS public.roster_pattern_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id uuid NOT NULL REFERENCES public.roster_patterns(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL DEFAULT 'updated',      -- 'created' | 'updated'
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{label, from, to}]
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS roster_pattern_logs_pattern_idx ON public.roster_pattern_logs(pattern_id, created_at DESC);
ALTER TABLE public.roster_pattern_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "rpl read" ON public.roster_pattern_logs FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "rpl write" ON public.roster_pattern_logs FOR ALL TO authenticated USING (public.is_admin() OR public.has_permission('employees:write')) WITH CHECK (public.is_admin() OR public.has_permission('employees:write')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
