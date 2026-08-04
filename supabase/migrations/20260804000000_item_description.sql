-- Product description, shown on the item detail page and (optionally) the
-- customer-facing order menu. Free-text, entered via a textarea on the
-- product create/edit form.
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS description text;
