-- Unit that default_purchase_cost is denominated in (e.g. cost entered
-- "per kg" for a gram-based ingredient). Must be compatible with the
-- item's own unit (same measurement group) — enforced in app code.
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS default_purchase_cost_unit text REFERENCES public.units(code);

-- Backfill existing rows: previously default_purchase_cost was always
-- implicitly per the item's own unit.
UPDATE public.items
SET default_purchase_cost_unit = unit
WHERE default_purchase_cost IS NOT NULL AND default_purchase_cost_unit IS NULL;
