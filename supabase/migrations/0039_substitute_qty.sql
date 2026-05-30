ALTER TABLE public.recipe_item_substitutes
  ADD COLUMN IF NOT EXISTS quantity numeric(14, 4) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS unit     text REFERENCES public.units(code);
