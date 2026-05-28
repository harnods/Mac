-- Add is_sellable flag to items (for prep items that can be sold à la carte / in sets)
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_sellable BOOLEAN NOT NULL DEFAULT FALSE;
