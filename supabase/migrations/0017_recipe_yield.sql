ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS yield_qty numeric NOT NULL DEFAULT 1 CHECK (yield_qty > 0);
