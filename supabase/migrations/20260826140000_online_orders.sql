-- Consumer take-away ordering (order.machimoto.cafe). Guest checkout; the
-- public storefront reads/writes these via server actions (service role +
-- access_token), so RLS stays locked to staff for the admin board.

CREATE SEQUENCE IF NOT EXISTS public.online_order_seq START 1001;

CREATE TABLE IF NOT EXISTS public.online_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token uuid NOT NULL DEFAULT gen_random_uuid(),
  order_number text NOT NULL,
  pickup_code text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment','paid','preparing','ready','picked_up','cancelled')),
  payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','paid','failed','expired')),
  payment_method text,
  payment_ref text,
  subtotal numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.online_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.online_orders(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
  name_snapshot text NOT NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  qty integer NOT NULL DEFAULT 1,
  line_total numeric NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS online_orders_status_idx ON public.online_orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS online_orders_token_idx ON public.online_orders(access_token);
CREATE INDEX IF NOT EXISTS online_order_items_order_idx ON public.online_order_items(order_id);

-- Auto number + pickup code on insert.
CREATE OR REPLACE FUNCTION public.online_order_defaults() RETURNS trigger AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'MO-' || nextval('public.online_order_seq');
  END IF;
  IF NEW.pickup_code IS NULL OR NEW.pickup_code = '' THEN
    NEW.pickup_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS online_order_defaults_trg ON public.online_orders;
CREATE TRIGGER online_order_defaults_trg BEFORE INSERT ON public.online_orders
  FOR EACH ROW EXECUTE FUNCTION public.online_order_defaults();

-- RLS: staff (back-office) read/write; the public storefront uses the service
-- role via server actions, so no anon policies are needed.
ALTER TABLE public.online_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_order_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "oo read" ON public.online_orders FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "oo write" ON public.online_orders FOR ALL TO authenticated USING (public.is_admin() OR public.has_permission('sales:write')) WITH CHECK (public.is_admin() OR public.has_permission('sales:write')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "ooi read" ON public.online_order_items FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "ooi write" ON public.online_order_items FOR ALL TO authenticated USING (public.is_admin() OR public.has_permission('sales:write')) WITH CHECK (public.is_admin() OR public.has_permission('sales:write')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
