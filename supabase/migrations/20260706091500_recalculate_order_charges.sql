WITH order_subtotals AS (
  SELECT
    order_id,
    COALESCE(SUM(line_total), 0)::numeric(14, 2) AS item_subtotal
  FROM public.order_items
  GROUP BY order_id
),
recalculated AS (
  SELECT
    order_id,
    item_subtotal,
    ROUND(item_subtotal * 0.05)::numeric(14, 2) AS service_charge,
    ROUND((item_subtotal + ROUND(item_subtotal * 0.05)) * 0.10)::numeric(14, 2) AS tax_total
  FROM order_subtotals
  WHERE item_subtotal > 0
)
UPDATE public.orders AS orders
SET
  subtotal = recalculated.item_subtotal,
  service_charge = recalculated.service_charge,
  tax_total = recalculated.tax_total,
  total = recalculated.item_subtotal + recalculated.service_charge + recalculated.tax_total
FROM recalculated
WHERE orders.id = recalculated.order_id
  AND (
    orders.subtotal = 0
    OR orders.service_charge = 0
    OR orders.tax_total = 0
    OR orders.total = recalculated.item_subtotal
  );
