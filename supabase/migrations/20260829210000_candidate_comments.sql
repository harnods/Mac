-- Internal comments/notes on a candidate (recruiter collaboration).
CREATE TABLE IF NOT EXISTS public.candidate_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS candidate_comments_candidate_idx ON public.candidate_comments(candidate_id);

ALTER TABLE public.candidate_comments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "candidate_comments staff read" ON public.candidate_comments
  FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "candidate_comments staff write" ON public.candidate_comments
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_permission('employees:write'))
  WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
