-- How many of the 7 days in a week are working days (the rest are day off).
ALTER TABLE public.attendance_settings
  ADD COLUMN IF NOT EXISTS working_days_per_week int NOT NULL DEFAULT 6;
