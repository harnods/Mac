-- How each sales entry's net sales was collected (EDC Bank Mandiri, QRIS, Cash, …).
-- Manually entered; the sum must equal the entry's net_sales (enforced in the app).
CREATE TABLE IF NOT EXISTS public.sales_entry_payments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id   uuid NOT NULL REFERENCES public.sales_entries(id) ON DELETE CASCADE,
  method     text NOT NULL,
  amount     numeric(14, 2) NOT NULL CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sales_entry_payments_entry_idx ON public.sales_entry_payments (entry_id);

ALTER TABLE public.sales_entry_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_entry_payments read" ON public.sales_entry_payments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "sales_entry_payments write" ON public.sales_entry_payments
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_permission('sales:write'))
  WITH CHECK (public.is_admin() OR public.has_permission('sales:write'));
