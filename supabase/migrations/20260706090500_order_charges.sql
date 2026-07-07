ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS subtotal numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_charge numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_total numeric(14, 2) NOT NULL DEFAULT 0;

UPDATE public.orders
SET subtotal = total
WHERE subtotal = 0
  AND service_charge = 0
  AND tax_total = 0
  AND total > 0;
