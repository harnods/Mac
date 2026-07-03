-- Add-on flag for products (e.g. Coconut Milk sold as an extra add-on on other drinks)
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS is_addon BOOLEAN NOT NULL DEFAULT FALSE;
