-- Add is_owner flag to profiles.
-- The account owner cannot be deleted or have their role changed.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false;

-- Prevent deleting the account owner via RLS isn't practical here
-- since deletion goes through service role. Guard is enforced at the app layer.
