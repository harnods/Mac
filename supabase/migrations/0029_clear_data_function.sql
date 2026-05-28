-- RPC function to clear all operational data, keeping profiles and system units.
-- Admin-only: verified inside the function.
CREATE OR REPLACE FUNCTION public.clear_all_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  -- Verify caller is admin
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  -- Truncate all operational tables in dependency order (CASCADE handles any remaining refs)
  TRUNCATE TABLE
    stock_ledger,
    sales_entry_items,
    sales_entries,
    stock_adjustments,
    stock_count_items,
    stock_counts,
    purchase_items,
    purchase_request_items,
    purchase_requests,
    purchases,
    prep_order_items,
    prep_orders,
    recipe_items,
    product_set_items,
    recipes,
    items,
    categories
  RESTART IDENTITY CASCADE;

  -- Remove user-created units only
  DELETE FROM units WHERE is_system = false;
END;
$$;

-- Revoke public execute, only authenticated users (checked inside)
REVOKE ALL ON FUNCTION public.clear_all_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_all_data() TO authenticated;
