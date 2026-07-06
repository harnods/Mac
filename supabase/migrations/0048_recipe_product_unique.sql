-- A recipe's output item should be produced by exactly one recipe — several
-- places look up "the recipe that makes this item" with .maybeSingle(),
-- which errors if more than one row matches. Postgres UNIQUE constraints
-- allow multiple NULLs, so recipes with no linked output are unaffected.
ALTER TABLE public.recipes ADD CONSTRAINT recipes_product_id_unique UNIQUE (product_id);
