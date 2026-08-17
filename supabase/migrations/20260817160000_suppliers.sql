-- Suppliers master data (name + multiple PICs with WhatsApp), linked to
-- purchase requests and purchases.

CREATE TABLE IF NOT EXISTS public.suppliers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supplier_pics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  name        text NOT NULL,
  whatsapp    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS supplier_pics_supplier_idx ON public.supplier_pics (supplier_id);

DROP TRIGGER IF EXISTS suppliers_touch ON public.suppliers;
CREATE TRIGGER suppliers_touch
BEFORE UPDATE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_pics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers read" ON public.suppliers;
CREATE POLICY "suppliers read" ON public.suppliers
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "suppliers write" ON public.suppliers;
CREATE POLICY "suppliers write" ON public.suppliers
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_permission('purchasing:purchase') OR public.has_permission('purchasing:request'))
  WITH CHECK (public.is_admin() OR public.has_permission('purchasing:purchase') OR public.has_permission('purchasing:request'));

DROP POLICY IF EXISTS "supplier_pics read" ON public.supplier_pics;
CREATE POLICY "supplier_pics read" ON public.supplier_pics
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "supplier_pics write" ON public.supplier_pics;
CREATE POLICY "supplier_pics write" ON public.supplier_pics
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_permission('purchasing:purchase') OR public.has_permission('purchasing:request'))
  WITH CHECK (public.is_admin() OR public.has_permission('purchasing:purchase') OR public.has_permission('purchasing:request'));

-- Link suppliers to purchase requests and purchases (nullable, additive).
ALTER TABLE public.purchase_requests
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS purchase_requests_supplier_idx ON public.purchase_requests (supplier_id);
CREATE INDEX IF NOT EXISTS purchases_supplier_idx ON public.purchases (supplier_id);
