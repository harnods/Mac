-- Daily stock count (daily stock reconciliation)
--
-- A per-day, per-item reconciliation of theoretical vs actual stock:
--
--   expected closing = opening + received - sold - r&d - waste
--   variance         = counted - expected closing
--
-- `sold_qty` is snapshotted from the sales recorded on the count date (the
-- `sales_consumption` stock_ledger rows written by the sales recap and the POS
-- settle-bill flow), so it is theoretical usage derived from recipes.

CREATE TABLE IF NOT EXISTS public.daily_stock_counts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  count_date   date NOT NULL DEFAULT CURRENT_DATE,
  note         text CHECK (char_length(note) <= 500),
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'counting', 'completed')),
  created_by   uuid REFERENCES public.profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  started_at   timestamptz,
  started_by   uuid REFERENCES public.profiles(id),
  completed_at timestamptz,
  completed_by uuid REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS daily_stock_counts_status_created_at_idx
  ON public.daily_stock_counts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS daily_stock_counts_count_date_idx
  ON public.daily_stock_counts (count_date DESC);

CREATE TABLE IF NOT EXISTS public.daily_stock_count_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  count_id      uuid NOT NULL REFERENCES public.daily_stock_counts(id) ON DELETE CASCADE,
  item_id       uuid NOT NULL REFERENCES public.items(id),
  unit          text NOT NULL,
  opening_qty   numeric NOT NULL DEFAULT 0,  -- on hand at the start of the day
  received_qty  numeric,                     -- goods received during the day
  sold_qty      numeric NOT NULL DEFAULT 0,  -- theoretical usage from that day's sales
  rnd_qty       numeric,                     -- R&D / trial usage
  waste_qty     numeric,                     -- waste / spoilage
  counted_qty   numeric,                     -- actual closing count
  variance_note text CHECK (char_length(variance_note) <= 300),
  UNIQUE (count_id, item_id)
);

CREATE INDEX IF NOT EXISTS daily_stock_count_items_count_idx
  ON public.daily_stock_count_items (count_id);

-- Ledger type for the on-hand correction a finished daily count applies.
ALTER TABLE public.stock_ledger
  DROP CONSTRAINT IF EXISTS stock_ledger_type_check;

ALTER TABLE public.stock_ledger
  ADD CONSTRAINT stock_ledger_type_check CHECK (type IN (
    'purchase', 'pr_approved', 'pr_rejected',
    'adjustment_in', 'adjustment_out', 'count_adjustment',
    'daily_count_adjustment',
    'reservation', 'reservation_release',
    'prep_consumption', 'prep_output',
    'sales_consumption', 'sales_reversal'
  ));

ALTER TABLE public.daily_stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_stock_count_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_stock_counts read" ON public.daily_stock_counts;
CREATE POLICY "daily_stock_counts read" ON public.daily_stock_counts
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "daily_stock_counts write" ON public.daily_stock_counts;
CREATE POLICY "daily_stock_counts write" ON public.daily_stock_counts
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_permission('daily_stock_counts:write'))
  WITH CHECK (public.is_admin() OR public.has_permission('daily_stock_counts:write'));

DROP POLICY IF EXISTS "daily_stock_count_items read" ON public.daily_stock_count_items;
CREATE POLICY "daily_stock_count_items read" ON public.daily_stock_count_items
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "daily_stock_count_items write" ON public.daily_stock_count_items;
CREATE POLICY "daily_stock_count_items write" ON public.daily_stock_count_items
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_permission('daily_stock_counts:write'))
  WITH CHECK (public.is_admin() OR public.has_permission('daily_stock_counts:write'));
