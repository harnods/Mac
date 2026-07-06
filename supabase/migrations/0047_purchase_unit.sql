-- Per-ingredient custom purchase packaging unit (e.g. "bungkus", "pack") with
-- a fixed ratio to the item's own unit (e.g. 1 bungkus = 5000 g). Unlike the
-- universal g/kg and ml/l conversions in app code, this ratio is specific to
-- this ingredient's packaging and isn't a general unit-to-unit conversion.
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS purchase_unit text REFERENCES public.units(code);
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS purchase_unit_qty NUMERIC(14, 4) CHECK (purchase_unit_qty IS NULL OR purchase_unit_qty > 0);
