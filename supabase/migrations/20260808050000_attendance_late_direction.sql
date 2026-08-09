-- Whether the late tolerance is measured after the shift start (grace period)
-- or before it (crew must clock in ahead of the start time).
ALTER TABLE public.attendance_settings
  ADD COLUMN IF NOT EXISTS late_tolerance_direction text NOT NULL DEFAULT 'after'
    CHECK (late_tolerance_direction IN ('before', 'after'));
