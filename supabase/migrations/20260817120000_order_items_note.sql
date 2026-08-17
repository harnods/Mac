-- Per-item note from the customer (shown to the checker + printed on the docket).
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS note text;
