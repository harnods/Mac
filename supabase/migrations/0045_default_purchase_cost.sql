-- Manually-set default/expected purchase cost per unit, shown as a fallback
-- alongside the auto-computed last_purchase_cost / avg_purchase_cost.
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS default_purchase_cost NUMERIC(14, 2);
