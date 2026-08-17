-- Record where/when crew punch in/out and let admins enforce it:
--  • IP address (auditable — previously the check happened but the IP wasn't saved)
--  • GPS coordinates + a store geofence (radius) so clock-in must be at the store
--  • an allowed clock-in time window
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS clock_in_ip   text,
  ADD COLUMN IF NOT EXISTS clock_out_ip  text,
  ADD COLUMN IF NOT EXISTS clock_in_lat  numeric(9, 6),
  ADD COLUMN IF NOT EXISTS clock_in_lng  numeric(9, 6),
  ADD COLUMN IF NOT EXISTS clock_out_lat numeric(9, 6),
  ADD COLUMN IF NOT EXISTS clock_out_lng numeric(9, 6);

ALTER TABLE public.attendance_settings
  ADD COLUMN IF NOT EXISTS store_lat          numeric(9, 6),
  ADD COLUMN IF NOT EXISTS store_lng          numeric(9, 6),
  ADD COLUMN IF NOT EXISTS geofence_radius_m  integer,
  ADD COLUMN IF NOT EXISTS require_location   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS clock_in_earliest  time,
  ADD COLUMN IF NOT EXISTS clock_in_latest    time;
