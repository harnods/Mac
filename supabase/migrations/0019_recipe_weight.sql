-- Add weight_per_pcs and weight_unit columns to recipes
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS weight_per_pcs NUMERIC,
  ADD COLUMN IF NOT EXISTS weight_unit TEXT;
