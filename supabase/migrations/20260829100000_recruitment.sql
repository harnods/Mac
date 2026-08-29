-- HR Recruitment: job openings (with a public 3-char apply code) + candidates
-- (public applications) + a private resumes bucket (PII, served via signed URL).

-- ── Job openings ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_openings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,                 -- 3-char public apply code (hire.machimoto.cafe/<code>)
  title text,                                -- optional custom title; falls back to the position name
  job_position_id uuid REFERENCES public.job_positions(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  job_level_id uuid REFERENCES public.job_levels(id) ON DELETE SET NULL,
  employment_status_id uuid REFERENCES public.employment_statuses(id) ON DELETE SET NULL,
  min_experience_years numeric NOT NULL DEFAULT 0,
  headcount int NOT NULL DEFAULT 1,
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Candidates (applications) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opening_id uuid NOT NULL REFERENCES public.job_openings(id) ON DELETE CASCADE,
  name text NOT NULL,
  whatsapp text NOT NULL,
  email text,
  experience_years numeric,
  expected_salary numeric,
  cover_note text,
  resume_path text,                          -- path in the private "resumes" bucket
  stage text NOT NULL DEFAULT 'applied'
    CHECK (stage IN ('applied','screening','interview','offer','hired','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS candidates_opening_idx ON public.candidates(opening_id);

-- Unique 3-char apply code from an unambiguous alphabet (no 0/1/o/i/l). Retry
-- on the rare collision. Blank code on insert triggers generation.
CREATE OR REPLACE FUNCTION public.job_opening_code() RETURNS trigger AS $$
DECLARE
  alphabet constant text := '23456789abcdefghjkmnpqrstuvwxyz';
  gen text;
  i int;
BEGIN
  IF NEW.code IS NOT NULL AND NEW.code <> '' THEN RETURN NEW; END IF;
  LOOP
    gen := '';
    FOR i IN 1..3 LOOP
      gen := gen || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.job_openings WHERE code = gen);
  END LOOP;
  NEW.code := gen;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS job_opening_code_trg ON public.job_openings;
CREATE TRIGGER job_opening_code_trg BEFORE INSERT ON public.job_openings
  FOR EACH ROW EXECUTE FUNCTION public.job_opening_code();

-- ── RLS: staff-only. The public apply flow reaches these via service role. ────
ALTER TABLE public.job_openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "job_openings staff read" ON public.job_openings
  FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "job_openings staff write" ON public.job_openings
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_permission('employees:write'))
  WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "candidates staff read" ON public.candidates
  FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "candidates staff write" ON public.candidates
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_permission('employees:write'))
  WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Private resumes bucket (PII). Uploads + reads go through service role. ────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('resumes', 'resumes', false, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Let signed-in admins read in the dashboard; writes/anon reads are service-role only.
DO $$ BEGIN CREATE POLICY "resumes admin read" ON storage.objects
  FOR SELECT USING (bucket_id = 'resumes' AND public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
