-- Customer-facing ordering: sell prices, customers, orders, order_items.
-- Orders are placed by customers (no auth) via the public /order app — those
-- inserts run server-side with the service-role key (bypasses RLS). The Mac
-- web (authenticated staff) reads/updates orders and subscribes via Realtime.

-- 1) Sell price on items (only meaningful for is_sellable items)
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS sell_price NUMERIC(14, 2);

-- 2) Customers — keyed by WhatsApp number, deduped on phone
CREATE TABLE IF NOT EXISTS public.customers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      TEXT NOT NULL UNIQUE,
  name       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Orders
-- order_number is a human-friendly running code: 1 letter + 3 digits.
-- A001..A999, then B001..B999, etc. Derived from a global sequence.
CREATE SEQUENCE IF NOT EXISTS public.order_seq;

CREATE TABLE IF NOT EXISTS public.orders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seq            BIGINT NOT NULL DEFAULT nextval('public.order_seq'),
  order_number   TEXT GENERATED ALWAYS AS (
                   chr(65 + ((seq - 1) / 999)::int)
                   || lpad((((seq - 1) % 999) + 1)::text, 3, '0')
                 ) STORED,
  customer_id    UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_phone TEXT NOT NULL,
  customer_name  TEXT,
  status         TEXT NOT NULL DEFAULT 'new'
                   CHECK (status IN ('new', 'preparing', 'ready', 'completed', 'cancelled')),
  total          NUMERIC(14, 2) NOT NULL DEFAULT 0,
  notes          TEXT,
  printed_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_status_idx  ON public.orders (status);
CREATE INDEX IF NOT EXISTS orders_created_idx ON public.orders (created_at DESC);

CREATE TRIGGER orders_touch
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) Order line items (price snapshotted at order time)
CREATE TABLE IF NOT EXISTS public.order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  item_id       UUID REFERENCES public.items(id) ON DELETE SET NULL,
  name_snapshot TEXT NOT NULL,
  qty           NUMERIC NOT NULL CHECK (qty > 0),
  unit_price    NUMERIC(14, 2) NOT NULL DEFAULT 0,
  line_total    NUMERIC(14, 2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS order_items_order_idx ON public.order_items (order_id);

-- 5) RLS — authenticated staff can read & update; inserts come from service role.
ALTER TABLE public.customers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read customers"
  ON public.customers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can read orders"
  ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can update orders"
  ON public.orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can read order_items"
  ON public.order_items FOR SELECT TO authenticated USING (true);

-- 6) Realtime — let the Mac web subscribe to live order changes.
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
