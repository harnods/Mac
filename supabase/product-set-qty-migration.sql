-- Add qty column to product_set_items (default 1 for existing rows)
ALTER TABLE public.product_set_items
  ADD COLUMN IF NOT EXISTS qty NUMERIC NOT NULL DEFAULT 1 CHECK (qty > 0);
