-- Which station a recipe's menu item belongs to (Bar or Kitchen). Optional.
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS station text CHECK (station IN ('bar', 'kitchen'));
