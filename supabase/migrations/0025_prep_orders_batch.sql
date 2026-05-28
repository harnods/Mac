-- Add batch_count to prep_orders
ALTER TABLE public.prep_orders
  ADD COLUMN IF NOT EXISTS batch_count numeric NOT NULL DEFAULT 1 CHECK (batch_count > 0);
