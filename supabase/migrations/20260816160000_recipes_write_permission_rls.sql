-- Fix: crew/chef granted `recipes:write` could open the recipe editor but got an
-- RLS error on save, because the recipes / recipe_items / recipe_item_substitutes
-- write policies were gated on is_admin() (role = 'admin') only. The app layer
-- authorizes recipe writes by the `recipes:write` permission (with station-scope
-- checks), so the RLS must honor that permission too.

-- Permission check for the current user, mirroring get_my_permissions().
CREATE OR REPLACE FUNCTION public.has_permission(perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN roles r ON r.name = p.role::text
    JOIN role_permissions rp ON rp.role_id = r.id
    WHERE p.id = auth.uid() AND rp.permission_key = perm
  );
$$;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;

-- recipes
DROP POLICY IF EXISTS "admin manage recipes" ON public.recipes;
CREATE POLICY "write recipes" ON public.recipes
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_permission('recipes:write'))
  WITH CHECK (public.is_admin() OR public.has_permission('recipes:write'));

-- recipe_items
DROP POLICY IF EXISTS "admin manage recipe_items" ON public.recipe_items;
CREATE POLICY "write recipe_items" ON public.recipe_items
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_permission('recipes:write'))
  WITH CHECK (public.is_admin() OR public.has_permission('recipes:write'));

-- recipe_item_substitutes
DROP POLICY IF EXISTS "recipe_item_substitutes admin write" ON public.recipe_item_substitutes;
CREATE POLICY "recipe_item_substitutes write" ON public.recipe_item_substitutes
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_permission('recipes:write'))
  WITH CHECK (public.is_admin() OR public.has_permission('recipes:write'));
