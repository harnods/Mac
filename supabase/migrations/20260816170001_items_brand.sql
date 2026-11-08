-- Brand is used by Assets (supply items); nullable text on the shared items table.
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS brand text;
