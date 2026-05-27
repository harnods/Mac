-- Add unit column to recipes (for WIP yield unit)
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS unit TEXT;

-- Seed "portion" unit if not exists
INSERT INTO public.units (code, is_system)
  VALUES ('portion', false)
  ON CONFLICT (code) DO NOTHING;
