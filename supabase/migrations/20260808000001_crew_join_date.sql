-- Crew (employee) join date, used to show tenure on the crew detail page.
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS join_date date;
