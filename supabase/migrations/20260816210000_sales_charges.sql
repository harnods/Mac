-- Sales entries record shift + a money breakdown (snapshot at save time):
-- gross sales, total discount, service charge (5% of gross), PB1 tax (10% of
-- gross − discount + service charge), and net sales.
ALTER TABLE public.sales_entries
  ADD COLUMN IF NOT EXISTS shift text,
  ADD COLUMN IF NOT EXISTS gross_sales    numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_discount numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_charge numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_total      numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_sales      numeric(14, 2) NOT NULL DEFAULT 0;
