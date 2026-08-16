-- Fix: crew/chef with granular write permissions could EDIT items (a permissive
-- "items staff update qty" UPDATE policy with USING(true) let them) but could
-- NOT ADD or DELETE, because items INSERT/DELETE — and categories/units writes —
-- were still gated on is_admin() only. Align these policies with the app's
-- granular per-type write permissions (see itemWritePermission()).
--
-- items UPDATE policies are intentionally left untouched so stock adjustments and
-- edits keep working. (The permissive "items staff update qty" policy remains a
-- known over-broad grant to revisit separately.)

-- ── items: add / delete by per-type write permission ────────────────────────
DROP POLICY IF EXISTS "items admin insert" ON public.items;
CREATE POLICY "write items insert" ON public.items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (type = 'ingredient' AND public.has_permission('ingredients:write'))
    OR (type = 'supply'     AND public.has_permission('assets:write'))
    OR (type = 'prep_item'  AND public.has_permission('prep_items:write'))
    OR (type = 'product'    AND public.has_permission('products:write'))
  );

DROP POLICY IF EXISTS "items admin delete" ON public.items;
CREATE POLICY "write items delete" ON public.items
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (type = 'ingredient' AND public.has_permission('ingredients:write'))
    OR (type = 'supply'     AND public.has_permission('assets:write'))
    OR (type = 'prep_item'  AND public.has_permission('prep_items:write'))
    OR (type = 'product'    AND public.has_permission('products:write'))
  );

-- ── categories: add / edit / delete by categories:write ─────────────────────
DROP POLICY IF EXISTS "categories admin insert" ON public.categories;
CREATE POLICY "write categories insert" ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.has_permission('categories:write'));
DROP POLICY IF EXISTS "categories admin update" ON public.categories;
CREATE POLICY "write categories update" ON public.categories
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.has_permission('categories:write'))
  WITH CHECK (public.is_admin() OR public.has_permission('categories:write'));
DROP POLICY IF EXISTS "categories admin delete" ON public.categories;
CREATE POLICY "write categories delete" ON public.categories
  FOR DELETE TO authenticated
  USING (public.is_admin() OR public.has_permission('categories:write'));

-- ── units: add / delete by units:write (keep is_system guard) ───────────────
DROP POLICY IF EXISTS "units admin insert" ON public.units;
CREATE POLICY "write units insert" ON public.units
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin() OR public.has_permission('units:write')) AND NOT is_system);
DROP POLICY IF EXISTS "units admin delete" ON public.units;
CREATE POLICY "write units delete" ON public.units
  FOR DELETE TO authenticated
  USING ((public.is_admin() OR public.has_permission('units:write')) AND NOT is_system);
