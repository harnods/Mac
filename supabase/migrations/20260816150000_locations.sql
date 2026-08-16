-- Storage locations master data (e.g. "Dry store", "Chiller A", "Bar shelf").
-- A supply item can record which location it lives in.
CREATE TABLE IF NOT EXISTS public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER locations_touch
BEFORE UPDATE ON public.locations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Mirror categories/units: any authenticated user can read; only admin writes.
CREATE POLICY "locations read all" ON public.locations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "locations admin insert" ON public.locations
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "locations admin update" ON public.locations
  FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "locations admin delete" ON public.locations
  FOR DELETE TO authenticated USING (public.is_admin());

-- Which location an item lives in (used by supplies). Optional.
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS items_location_idx ON public.items (location_id);
