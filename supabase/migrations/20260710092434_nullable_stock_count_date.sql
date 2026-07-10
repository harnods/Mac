ALTER TABLE public.stock_counts
  ALTER COLUMN count_date DROP NOT NULL,
  ALTER COLUMN count_date DROP DEFAULT;
