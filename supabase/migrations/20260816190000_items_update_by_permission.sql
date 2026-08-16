-- Tighten the over-broad items UPDATE policy. Previously "items staff update qty"
-- used USING(true), letting ANY authenticated user update ANY item field. Replace
-- with a permission-scoped policy that still covers every legitimate flow that
-- updates items via the RLS-bound client:
--   • item edit            → per-type write (ingredients/assets/prep_items/products)
--   • stock adjustment      → stock_adjustments:write
--   • stock count apply     → stock_counts:write
--   • purchase recording    → purchasing:purchase (updates cost / on_hand)
--   • prep order completion → prep_orders:complete (adjusts on_hand)
-- A user holding none of these can no longer modify items. (RLS can't restrict
-- by column; per-flow column safety remains enforced in the server actions.)

-- Create the new policy first, then drop the old ones — so there is never a
-- window where item updates are over-restricted.
CREATE POLICY "items update by perm" ON public.items
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (type = 'ingredient' AND public.has_permission('ingredients:write'))
    OR (type = 'supply'     AND public.has_permission('assets:write'))
    OR (type = 'prep_item'  AND public.has_permission('prep_items:write'))
    OR (type = 'product'    AND public.has_permission('products:write'))
    OR public.has_permission('stock_adjustments:write')
    OR public.has_permission('stock_counts:write')
    OR public.has_permission('purchasing:purchase')
    OR public.has_permission('prep_orders:complete')
  )
  WITH CHECK (
    public.is_admin()
    OR (type = 'ingredient' AND public.has_permission('ingredients:write'))
    OR (type = 'supply'     AND public.has_permission('assets:write'))
    OR (type = 'prep_item'  AND public.has_permission('prep_items:write'))
    OR (type = 'product'    AND public.has_permission('products:write'))
    OR public.has_permission('stock_adjustments:write')
    OR public.has_permission('stock_counts:write')
    OR public.has_permission('purchasing:purchase')
    OR public.has_permission('prep_orders:complete')
  );

DROP POLICY IF EXISTS "items staff update qty" ON public.items;
DROP POLICY IF EXISTS "items admin update" ON public.items;
