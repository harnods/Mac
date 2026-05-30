-- Add soft-delete column to items table
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS items_deleted_at_idx ON public.items (deleted_at)
  WHERE deleted_at IS NULL;
