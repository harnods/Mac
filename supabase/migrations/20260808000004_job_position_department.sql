-- Link each job position to a department.
ALTER TABLE public.job_positions
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id);
