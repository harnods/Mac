-- Track when points are forfeited (bill closed without claiming)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS points_void BOOLEAN NOT NULL DEFAULT FALSE;
