-- Station-scope prep items and prep orders by the same bar/kitchen rule used for
-- recipes. A prep item's station is its producing recipe's station; a prep
-- order's station is its recipe's station. A role limited to one station (has
-- exactly one of recipes:bar / recipes:kitchen) may only see/act on that
-- station; null-station (uncategorized) is visible to everyone.

-- Returns whether the current user may access a recipe of the given station.
-- Mirrors src/lib/permissions.ts allowedRecipeStations()/canAccessRecipeStation().
CREATE OR REPLACE FUNCTION public.has_recipe_station_access(station text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  bar boolean;
  kitchen boolean;
BEGIN
  IF station IS NULL THEN RETURN true; END IF;                    -- uncategorized: everyone
  IF public.is_admin() THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_owner) THEN RETURN true; END IF;
  bar := public.has_permission('recipes:bar');
  kitchen := public.has_permission('recipes:kitchen');
  IF bar = kitchen THEN RETURN true; END IF;                      -- neither or both: no limit
  RETURN (station = 'bar' AND bar) OR (station = 'kitchen' AND kitchen);
END;
$$;
GRANT EXECUTE ON FUNCTION public.has_recipe_station_access(text) TO authenticated;

-- Prep orders: creating one for a recipe outside your station is blocked at the
-- DB layer (in addition to the server action). Tighten the existing permission
-- policy to AND the station check on the referenced recipe.
DROP POLICY IF EXISTS "perm write prep_orders insert" ON public.prep_orders;
CREATE POLICY "perm write prep_orders insert" ON public.prep_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_admin() OR public.has_permission('prep_orders:write') OR public.has_permission('prep_orders:complete'))
    AND public.has_recipe_station_access((SELECT r.station FROM public.recipes r WHERE r.id = recipe_id))
  );
