-- Snapshot each requested item's available stock (on_hand - reserved) at the
-- moment the purchase request is created, so it never drifts as stock changes.
ALTER TABLE public.purchase_request_items
  ADD COLUMN IF NOT EXISTS available_snapshot numeric,
  ADD COLUMN IF NOT EXISTS available_unit text;
