-- Track who first recorded each attendance row and from what kind of device.
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web'
    CHECK (source IN ('web', 'mobile'));

-- Backfill existing rows: creator = last updater, origin = web (admin-entered).
UPDATE public.attendance SET created_by = updated_by WHERE created_by IS NULL;
