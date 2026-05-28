-- Sales entries (nightly closing recap)
CREATE TABLE IF NOT EXISTS public.sales_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date  DATE NOT NULL,
  notes       TEXT,
  created_by  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Line items per entry
CREATE TABLE IF NOT EXISTS public.sales_entry_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    UUID NOT NULL REFERENCES public.sales_entries(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES public.items(id),
  qty         NUMERIC NOT NULL CHECK (qty > 0),
  unit        TEXT NOT NULL
);

-- Add sales_consumption to stock_ledger type constraint
ALTER TABLE public.stock_ledger
  DROP CONSTRAINT IF EXISTS stock_ledger_type_check;

ALTER TABLE public.stock_ledger
  ADD CONSTRAINT stock_ledger_type_check CHECK (type IN (
    'purchase', 'pr_approved', 'pr_rejected',
    'adjustment_in', 'adjustment_out', 'count_adjustment',
    'reservation', 'reservation_release',
    'prep_consumption', 'prep_output',
    'sales_consumption'
  ));

-- RLS
ALTER TABLE public.sales_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_entry_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read sales_entries"
  ON public.sales_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read sales_entry_items"
  ON public.sales_entry_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert sales_entries"
  ON public.sales_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can insert sales_entry_items"
  ON public.sales_entry_items FOR INSERT TO authenticated WITH CHECK (true);
