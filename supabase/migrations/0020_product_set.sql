-- Add product_kind to items
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS product_kind TEXT NOT NULL DEFAULT 'ala_carte'
    CHECK (product_kind IN ('ala_carte', 'set'));

-- Set composition: which products are inside a set product
CREATE TABLE IF NOT EXISTS public.product_set_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id     UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.items(id),
  UNIQUE (set_id, product_id)
);

ALTER TABLE public.product_set_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read product_set_items"
  ON public.product_set_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert product_set_items"
  ON public.product_set_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can delete product_set_items"
  ON public.product_set_items FOR DELETE TO authenticated USING (true);

-- Ensure "set" unit exists
INSERT INTO public.units (code, is_system)
  VALUES ('set', false)
  ON CONFLICT (code) DO NOTHING;
