-- Add target_qty for planned yield, allow qty_to_prep to be null (set on completion)
ALTER TABLE prep_orders
  ADD COLUMN IF NOT EXISTS target_qty NUMERIC;

-- Allow qty_to_prep to be null for pending orders
ALTER TABLE prep_orders
  ALTER COLUMN qty_to_prep DROP NOT NULL;

-- Backfill target_qty from existing completed orders
UPDATE prep_orders SET target_qty = qty_to_prep WHERE target_qty IS NULL;

-- Expand status constraint to include 'pending'
ALTER TABLE prep_orders DROP CONSTRAINT IF EXISTS prep_orders_status_check;
ALTER TABLE prep_orders ADD CONSTRAINT prep_orders_status_check
  CHECK (status IN ('pending', 'planned', 'completed', 'cancelled'));

-- Set default status to pending
ALTER TABLE prep_orders ALTER COLUMN status SET DEFAULT 'pending';

-- Add yield variance reason
ALTER TABLE prep_orders
  ADD COLUMN IF NOT EXISTS yield_variance_reason TEXT;
