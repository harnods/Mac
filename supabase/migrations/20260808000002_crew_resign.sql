-- Crew resignation: termination date and last working day, set when a crew resigns.
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS termination_date date;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS last_day date;
