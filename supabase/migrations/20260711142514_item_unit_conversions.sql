CREATE TABLE IF NOT EXISTS public.item_unit_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  from_unit text NOT NULL REFERENCES public.units(code),
  factor numeric(14, 4) NOT NULL CHECK (factor > 0),
  to_unit text NOT NULL REFERENCES public.units(code),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id),
  CONSTRAINT item_unit_conversions_distinct_units CHECK (from_unit <> to_unit),
  CONSTRAINT item_unit_conversions_unique_item_from UNIQUE (item_id, from_unit)
);

CREATE INDEX IF NOT EXISTS item_unit_conversions_item_id_idx
  ON public.item_unit_conversions(item_id);

ALTER TABLE public.item_unit_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "item unit conversions read all" ON public.item_unit_conversions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "item unit conversions admin insert" ON public.item_unit_conversions
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "item unit conversions admin update" ON public.item_unit_conversions
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "item unit conversions admin delete" ON public.item_unit_conversions
  FOR DELETE TO authenticated USING (public.is_admin());

INSERT INTO public.item_unit_conversions (item_id, from_unit, factor, to_unit, updated_by)
SELECT id, purchase_unit, purchase_unit_qty, unit, updated_by
FROM public.items
WHERE purchase_unit IS NOT NULL
  AND purchase_unit_qty IS NOT NULL
  AND purchase_unit <> unit
ON CONFLICT (item_id, from_unit) DO NOTHING;
