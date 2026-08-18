-- Reusable item sets for the daily stock count, so the same list doesn't have
-- to be picked by hand every day.

CREATE TABLE IF NOT EXISTS public.daily_count_templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE CHECK (char_length(name) BETWEEN 1 AND 80),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.daily_count_template_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.daily_count_templates(id) ON DELETE CASCADE,
  item_id     uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  UNIQUE (template_id, item_id)
);

CREATE INDEX IF NOT EXISTS daily_count_template_items_template_idx
  ON public.daily_count_template_items (template_id);

DROP TRIGGER IF EXISTS daily_count_templates_touch ON public.daily_count_templates;
CREATE TRIGGER daily_count_templates_touch
BEFORE UPDATE ON public.daily_count_templates
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.daily_count_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_count_template_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_count_templates read" ON public.daily_count_templates;
CREATE POLICY "daily_count_templates read" ON public.daily_count_templates
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "daily_count_templates write" ON public.daily_count_templates;
CREATE POLICY "daily_count_templates write" ON public.daily_count_templates
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_permission('daily_stock_counts:write'))
  WITH CHECK (public.is_admin() OR public.has_permission('daily_stock_counts:write'));

DROP POLICY IF EXISTS "daily_count_template_items read" ON public.daily_count_template_items;
CREATE POLICY "daily_count_template_items read" ON public.daily_count_template_items
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "daily_count_template_items write" ON public.daily_count_template_items;
CREATE POLICY "daily_count_template_items write" ON public.daily_count_template_items
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_permission('daily_stock_counts:write'))
  WITH CHECK (public.is_admin() OR public.has_permission('daily_stock_counts:write'));
