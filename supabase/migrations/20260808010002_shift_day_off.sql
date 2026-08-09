-- "Day off" is a default shift with no working hours. Each crew gets a weekly
-- day off (cafe staff aren't all off on the same day), so it's modeled as a shift.
ALTER TABLE public.shifts ALTER COLUMN start_time DROP NOT NULL;
ALTER TABLE public.shifts ALTER COLUMN end_time DROP NOT NULL;

INSERT INTO public.shifts (name, start_time, end_time, break_minutes)
VALUES ('Day off', NULL, NULL, 0)
ON CONFLICT (name) DO NOTHING;
