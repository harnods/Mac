-- Basic salary can be paid per day or per month (part-time crew choose).
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS salary_unit text CHECK (salary_unit IN ('day', 'month'));

-- Backfill: part-time defaults to per day, everyone else per month.
UPDATE public.employees e
SET salary_unit = CASE WHEN lower(coalesce(es.name, '')) LIKE '%part%' THEN 'day' ELSE 'month' END
FROM public.employment_statuses es
WHERE e.employment_status_id = es.id AND e.salary_unit IS NULL;
UPDATE public.employees SET salary_unit = 'month' WHERE salary_unit IS NULL;
