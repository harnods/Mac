-- Crew self-service: forced password change, store-network IP allowlist, break tracking.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
ALTER TABLE public.attendance_settings ADD COLUMN IF NOT EXISTS allowed_ips text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS break_start time;

-- Reuse the "staff" role as "Crew".
UPDATE public.roles SET name = 'crew' WHERE name = 'staff';
UPDATE public.profiles SET role = 'crew' WHERE role = 'staff';
