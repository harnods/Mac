-- Candidate activity log: application + stage moves (who/when).
CREATE TABLE IF NOT EXISTS public.candidate_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('applied','stage_changed','hired')),
  from_stage text,
  to_stage text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS candidate_events_candidate_idx ON public.candidate_events(candidate_id);

ALTER TABLE public.candidate_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "candidate_events staff read" ON public.candidate_events
  FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "candidate_events staff write" ON public.candidate_events
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_permission('employees:write'))
  WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
