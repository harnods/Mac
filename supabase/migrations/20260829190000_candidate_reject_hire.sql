-- Rejection reason (optional) + link to the crew record created when hired.
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS reject_reason text,
  ADD COLUMN IF NOT EXISTS hired_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;
