-- Columns that were added to production directly (via the SQL Editor) without a
-- migration file. Captured here so local/fresh databases match production.
-- Idempotent: safe to run on production, where these columns already exist.

-- Recruitment: whether a job position is open for applications.
ALTER TABLE public.job_positions
  ADD COLUMN IF NOT EXISTS accepting_applications boolean NOT NULL DEFAULT true;

-- Online order payments: payment link and its expiry.
ALTER TABLE public.online_orders
  ADD COLUMN IF NOT EXISTS payment_url text,
  ADD COLUMN IF NOT EXISTS payment_expires_at timestamptz;
