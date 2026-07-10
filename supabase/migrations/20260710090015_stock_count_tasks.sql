ALTER TABLE public.stock_counts
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES public.profiles(id);

ALTER TABLE public.stock_counts
  DROP CONSTRAINT IF EXISTS stock_counts_status_check;

ALTER TABLE public.stock_counts
  ADD CONSTRAINT stock_counts_status_check
  CHECK (status IN ('draft', 'counting', 'completed'));

CREATE INDEX IF NOT EXISTS stock_counts_status_created_at_idx
  ON public.stock_counts (status, created_at DESC);
