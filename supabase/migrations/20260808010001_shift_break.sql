-- Break duration (minutes) for each shift, taken anytime within shift hours.
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS break_minutes int NOT NULL DEFAULT 0;
