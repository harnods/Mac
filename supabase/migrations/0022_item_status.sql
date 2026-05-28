-- Add status column to items (for product draft/active workflow)
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'draft'));
