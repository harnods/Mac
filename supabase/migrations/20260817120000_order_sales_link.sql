-- Link a settled POS bill to the Sales entry it generated (auto-recorded on
-- "Settle & pay"). Nullable + additive; SET NULL so deleting a sales entry
-- never removes the order history.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS sales_entry_id uuid REFERENCES public.sales_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_sales_entry_idx ON public.orders (sales_entry_id);
