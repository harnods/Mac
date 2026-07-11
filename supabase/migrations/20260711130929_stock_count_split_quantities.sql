ALTER TABLE public.stock_count_items
  ADD COLUMN IF NOT EXISTS unopened_qty numeric,
  ADD COLUMN IF NOT EXISTS unopened_unit text,
  ADD COLUMN IF NOT EXISTS in_use_qty numeric,
  ADD COLUMN IF NOT EXISTS in_use_unit text;
