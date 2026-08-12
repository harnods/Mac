-- Store each completed break interval (start/end) per attendance day, so the
-- crew app can list "Break 1: 13:00 - 13:30", etc. break_minutes stays the
-- authoritative total used by payroll.
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS breaks jsonb NOT NULL DEFAULT '[]'::jsonb;
