-- Restaurant tables for QR-based table ordering
CREATE TABLE public.tables (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  code       TEXT NOT NULL UNIQUE,  -- short slug used in QR URL: /order/t/[code]
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage tables"
  ON public.tables FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public read tables"
  ON public.tables FOR SELECT TO anon USING (true);

-- Add table tracking columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS table_id            UUID REFERENCES public.tables(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS table_name_snapshot TEXT;

-- customer_phone is now optional — table orders have no phone
ALTER TABLE public.orders ALTER COLUMN customer_phone DROP NOT NULL;

CREATE INDEX IF NOT EXISTS orders_table_idx ON public.orders (table_id);
