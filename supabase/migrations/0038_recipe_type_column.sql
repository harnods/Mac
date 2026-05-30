ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS recipe_type TEXT NOT NULL DEFAULT 'wip'
  CHECK (recipe_type IN ('wip', 'product'));

-- Backfill from linked product item type
UPDATE public.recipes r
SET recipe_type = CASE
  WHEN i.type = 'product'   THEN 'product'
  WHEN i.type = 'prep_item' THEN 'wip'
  ELSE 'wip'
END
FROM public.items i
WHERE r.product_id = i.id;
