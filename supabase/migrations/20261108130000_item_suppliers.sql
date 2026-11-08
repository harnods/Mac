-- Which suppliers an ingredient can be bought from. An ingredient can have many
-- suppliers; exactly one of them is the primary supplier (when it has any).
--
-- Primary invariants are enforced here so every entry point (ingredient list
-- row/bulk, ingredient detail tab, supplier detail page) behaves the same:
--   * the first supplier added to an ingredient becomes primary automatically;
--   * inserting a row with is_primary = true demotes the previous primary;
--   * removing the primary promotes the oldest remaining supplier.

CREATE TABLE IF NOT EXISTS public.item_suppliers (
  item_id     uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  is_primary  boolean NOT NULL DEFAULT false,
  updated_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, supplier_id)
);

-- At most one primary supplier per item.
CREATE UNIQUE INDEX IF NOT EXISTS item_suppliers_one_primary
  ON public.item_suppliers (item_id) WHERE is_primary;
CREATE INDEX IF NOT EXISTS item_suppliers_supplier_idx
  ON public.item_suppliers (supplier_id);

DROP TRIGGER IF EXISTS item_suppliers_touch ON public.item_suppliers;
CREATE TRIGGER item_suppliers_touch
BEFORE UPDATE ON public.item_suppliers
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Before insert: first supplier → primary; explicit primary → demote the old one.
CREATE OR REPLACE FUNCTION public.item_suppliers_before_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_primary THEN
    UPDATE public.item_suppliers
      SET is_primary = false
      WHERE item_id = NEW.item_id AND is_primary;
  ELSIF NOT EXISTS (SELECT 1 FROM public.item_suppliers WHERE item_id = NEW.item_id) THEN
    NEW.is_primary := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS item_suppliers_before_insert ON public.item_suppliers;
CREATE TRIGGER item_suppliers_before_insert
BEFORE INSERT ON public.item_suppliers
FOR EACH ROW EXECUTE FUNCTION public.item_suppliers_before_insert();

-- After delete: if the primary was removed, promote the oldest remaining supplier.
CREATE OR REPLACE FUNCTION public.item_suppliers_after_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_primary THEN
    UPDATE public.item_suppliers
      SET is_primary = true
      WHERE (item_id, supplier_id) = (
        SELECT item_id, supplier_id
        FROM public.item_suppliers
        WHERE item_id = OLD.item_id
        ORDER BY created_at, supplier_id
        LIMIT 1
      );
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS item_suppliers_after_delete ON public.item_suppliers;
CREATE TRIGGER item_suppliers_after_delete
AFTER DELETE ON public.item_suppliers
FOR EACH ROW EXECUTE FUNCTION public.item_suppliers_after_delete();

-- Make a supplier the primary for an item (demote first so the unique index holds).
CREATE OR REPLACE FUNCTION public.set_item_supplier_primary(p_item_id uuid, p_supplier_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.item_suppliers WHERE item_id = p_item_id AND supplier_id = p_supplier_id
  ) THEN
    RAISE EXCEPTION 'Supplier is not linked to this item';
  END IF;

  UPDATE public.item_suppliers
    SET is_primary = false, updated_by = auth.uid()
    WHERE item_id = p_item_id AND is_primary AND supplier_id <> p_supplier_id;
  UPDATE public.item_suppliers
    SET is_primary = true, updated_by = auth.uid()
    WHERE item_id = p_item_id AND supplier_id = p_supplier_id;
END;
$$;

ALTER TABLE public.item_suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "item_suppliers read" ON public.item_suppliers;
CREATE POLICY "item_suppliers read" ON public.item_suppliers
  FOR SELECT TO authenticated USING (true);

-- Managed from the ingredient side (ingredients:write) or the purchasing side.
DROP POLICY IF EXISTS "item_suppliers write" ON public.item_suppliers;
CREATE POLICY "item_suppliers write" ON public.item_suppliers
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR public.has_permission('ingredients:write')
    OR public.has_permission('purchasing:purchase')
    OR public.has_permission('purchasing:request')
  )
  WITH CHECK (
    public.is_admin()
    OR public.has_permission('ingredients:write')
    OR public.has_permission('purchasing:purchase')
    OR public.has_permission('purchasing:request')
  );
