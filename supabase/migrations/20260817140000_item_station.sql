-- Per-product station routing for kitchen/bar dockets. Additive + nullable.
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS station text CHECK (station IN ('bar', 'kitchen'));

-- Seed product stations from their recipe's station where already set, so
-- existing bar/kitchen recipes route correctly without re-entry.
UPDATE public.items i
SET station = r.station
FROM public.recipes r
WHERE r.product_id = i.id
  AND r.station IS NOT NULL
  AND i.station IS NULL
  AND i.type = 'product';
