-- Candidate photo (public bucket, like crew/product photos, so it renders
-- inline on the pipeline). Résumés stay in the private "resumes" bucket.
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS photo_url text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('candidate-photos', 'candidate-photos', true, 5242880, ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN CREATE POLICY "candidate photos public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'candidate-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
