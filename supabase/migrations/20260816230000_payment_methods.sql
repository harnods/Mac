-- Master list of payment methods (Cash, QRIS, EDC Bank Mandiri, …) chosen when
-- splitting a sales entry's net sales.
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS payment_methods_touch ON public.payment_methods;
CREATE TRIGGER payment_methods_touch
BEFORE UPDATE ON public.payment_methods
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_methods read" ON public.payment_methods;
CREATE POLICY "payment_methods read" ON public.payment_methods
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "payment_methods write" ON public.payment_methods;
CREATE POLICY "payment_methods write" ON public.payment_methods
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_permission('sales:write'))
  WITH CHECK (public.is_admin() OR public.has_permission('sales:write'));

INSERT INTO public.payment_methods (name) VALUES ('Cash'), ('QRIS')
ON CONFLICT (name) DO NOTHING;
