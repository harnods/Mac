-- ============================================================
-- Mac — Production Database Update
-- Run this in Supabase SQL Editor (production project)
-- Migrations: 0030 → 0035
-- Apply in one pass — all statements are idempotent or wrapped
-- in BEGIN/COMMIT where needed.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 0030_employees.sql
-- ────────────────────────────────────────────────────────────
-- Departments
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name)
);
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "departments read authenticated" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "departments write admin" ON public.departments FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Job positions
CREATE TABLE IF NOT EXISTS public.job_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name)
);
ALTER TABLE public.job_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_positions read authenticated" ON public.job_positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "job_positions write admin" ON public.job_positions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Employment statuses
CREATE TABLE IF NOT EXISTS public.employment_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name)
);
ALTER TABLE public.employment_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employment_statuses read authenticated" ON public.employment_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "employment_statuses write admin" ON public.employment_statuses FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
-- Seed defaults
INSERT INTO public.employment_statuses (name) VALUES ('Permanent'), ('Contract'), ('Part-time') ON CONFLICT (name) DO NOTHING;

-- Job levels
CREATE TABLE IF NOT EXISTS public.job_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name)
);
ALTER TABLE public.job_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_levels read authenticated" ON public.job_levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "job_levels write admin" ON public.job_levels FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Employees
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  birthdate date,
  nik text,
  address text,
  marital_status text CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed')),
  gender text CHECK (gender IN ('male', 'female')),
  department_id uuid REFERENCES public.departments(id),
  job_position_id uuid REFERENCES public.job_positions(id),
  job_level_id uuid REFERENCES public.job_levels(id),
  employment_status_id uuid REFERENCES public.employment_statuses(id),
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employees read authenticated" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "employees write admin" ON public.employees FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);


-- ────────────────────────────────────────────────────────────
-- 0031_employee_user_id.sql
-- ────────────────────────────────────────────────────────────
-- Link employees to their Mac system account (profiles)
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;


-- ────────────────────────────────────────────────────────────
-- 0032_permissions.sql
-- ────────────────────────────────────────────────────────────
-- Roles table
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles read authenticated" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles write admin" ON public.roles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Permissions catalogue
CREATE TABLE IF NOT EXISTS public.permissions (
  key text PRIMARY KEY,
  module text NOT NULL,
  action text NOT NULL,
  description text NOT NULL
);
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permissions read authenticated" ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "permissions write admin" ON public.permissions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Role ↔ Permission mapping
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_key)
);
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_permissions read authenticated" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_permissions write admin" ON public.role_permissions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- RPC: returns array of permission keys for the calling user
CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(rp.permission_key), '{}')
  FROM profiles p
  JOIN roles r ON r.name = p.role::text
  JOIN role_permissions rp ON rp.role_id = r.id
  WHERE p.id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION public.get_my_permissions() TO authenticated;

-- ─── Seed permissions ───────────────────────────────────────────────────────
INSERT INTO public.permissions (key, module, action, description) VALUES
  ('inventory:read',       'inventory',  'read',     'View items, categories, units'),
  ('inventory:write',      'inventory',  'write',    'Add, edit, delete items, categories, units'),
  ('recipes:read',         'recipes',    'read',     'View recipes'),
  ('recipes:write',        'recipes',    'write',    'Add, edit, delete recipes'),
  ('prep_orders:read',     'prep_orders','read',     'View prep orders'),
  ('prep_orders:write',    'prep_orders','write',    'Create and cancel prep orders'),
  ('prep_orders:complete', 'prep_orders','complete', 'Complete a prep order (triggers stock deduction)'),
  ('sales:read',           'sales',      'read',     'View sales entries'),
  ('sales:write',          'sales',      'write',    'Create and edit sales entries'),
  ('purchasing:read',      'purchasing', 'read',     'View purchase requests and purchases'),
  ('purchasing:request',   'purchasing', 'request',  'Create and edit purchase requests'),
  ('purchasing:purchase',  'purchasing', 'purchase', 'Record purchases'),
  ('purchasing:approve',   'purchasing', 'approve',  'Approve or reject purchase requests'),
  ('stock:read',           'stock',      'read',     'View stock adjustments and counts'),
  ('stock:write',          'stock',      'write',    'Create stock adjustments and stock counts'),
  ('employees:read',       'employees',  'read',     'View employee list and details'),
  ('employees:write',      'employees',  'write',    'Add, edit, delete employees'),
  ('employees:access',     'employees',  'access',   'Grant or revoke system access for employees'),
  ('settings:roles',       'settings',   'roles',    'Manage roles and permissions')
ON CONFLICT (key) DO NOTHING;

-- ─── Seed roles ─────────────────────────────────────────────────────────────
INSERT INTO public.roles (name, description, is_system) VALUES
  ('admin',   'Full access to all modules and settings', true),
  ('manager', 'Full operational access; cannot manage roles or grant system access', true),
  ('chef',    'Prep orders, recipes, and inventory view', true),
  ('staff',   'Sales, purchase requests, and view-only access', true)
ON CONFLICT (name) DO NOTHING;

-- ─── Seed role_permissions ───────────────────────────────────────────────────
-- admin: all
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key FROM public.roles r, public.permissions p WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- manager: all except settings:roles and employees:access
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key FROM public.roles r, public.permissions p
WHERE r.name = 'manager' AND p.key NOT IN ('settings:roles','employees:access')
ON CONFLICT DO NOTHING;

-- chef
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key FROM public.roles r, public.permissions p
WHERE r.name = 'chef' AND p.key IN (
  'inventory:read','recipes:read','prep_orders:read','prep_orders:write','prep_orders:complete'
) ON CONFLICT DO NOTHING;

-- staff
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key FROM public.roles r, public.permissions p
WHERE r.name = 'staff' AND p.key IN (
  'inventory:read','recipes:read','prep_orders:read',
  'sales:read','sales:write','purchasing:read','purchasing:request'
) ON CONFLICT DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- 0033_profiles_role_text.sql
-- ────────────────────────────────────────────────────────────
-- Convert profiles.role from user_role enum to plain text.
-- Required so custom roles (manager, chef, etc.) can be stored.
--
-- Approach: drop all RLS policies that reference profiles.role
-- (they cast to user_role which breaks after enum removal),
-- alter the column, drop the enum, then recreate policies with text comparisons.
-- "Staff select" policies are broadened to any authenticated user since
-- app-level permission checks handle fine-grained access.

BEGIN;

-- ── Drop policies that depend on the user_role enum ──────────────────────────

DROP POLICY IF EXISTS "categories read all"                    ON public.categories;
DROP POLICY IF EXISTS "departments write admin"                ON public.departments;
DROP POLICY IF EXISTS "employees write admin"                  ON public.employees;
DROP POLICY IF EXISTS "employment_statuses write admin"        ON public.employment_statuses;
DROP POLICY IF EXISTS "items read all"                         ON public.items;
DROP POLICY IF EXISTS "items staff update qty"                 ON public.items;
DROP POLICY IF EXISTS "job_levels write admin"                 ON public.job_levels;
DROP POLICY IF EXISTS "job_positions write admin"              ON public.job_positions;
DROP POLICY IF EXISTS "permissions write admin"                ON public.permissions;
DROP POLICY IF EXISTS "Admin full access on prep_order_items"  ON public.prep_order_items;
DROP POLICY IF EXISTS "Staff select on prep_order_items"       ON public.prep_order_items;
DROP POLICY IF EXISTS "Admin full access on prep_orders"       ON public.prep_orders;
DROP POLICY IF EXISTS "Staff select on prep_orders"            ON public.prep_orders;
DROP POLICY IF EXISTS "profiles read authenticated"            ON public.profiles;
DROP POLICY IF EXISTS "role_permissions write admin"           ON public.role_permissions;
DROP POLICY IF EXISTS "roles write admin"                      ON public.roles;
DROP POLICY IF EXISTS "Admin full access on stock_adjustments" ON public.stock_adjustments;
DROP POLICY IF EXISTS "Staff select on stock_adjustments"      ON public.stock_adjustments;
DROP POLICY IF EXISTS "Admin full access on stock_count_items" ON public.stock_count_items;
DROP POLICY IF EXISTS "Staff select on stock_count_items"      ON public.stock_count_items;
DROP POLICY IF EXISTS "Admin full access on stock_counts"      ON public.stock_counts;
DROP POLICY IF EXISTS "Staff select on stock_counts"           ON public.stock_counts;

-- ── Change column type ────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ALTER COLUMN role TYPE text USING role::text;

ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'staff';

DROP TYPE IF EXISTS public.user_role;

-- ── Recreate policies with text comparisons ───────────────────────────────────

-- Helper: is the caller an admin?
-- (Used as the write guard across all tables)

-- categories
CREATE POLICY "categories read all" ON public.categories
  FOR SELECT TO authenticated USING (true);

-- items
CREATE POLICY "items read all" ON public.items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "items staff update qty" ON public.items
  FOR UPDATE TO authenticated USING (true);

-- profiles
CREATE POLICY "profiles read authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- departments
CREATE POLICY "departments write admin" ON public.departments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- employees
CREATE POLICY "employees write admin" ON public.employees
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- employment_statuses
CREATE POLICY "employment_statuses write admin" ON public.employment_statuses
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- job_levels
CREATE POLICY "job_levels write admin" ON public.job_levels
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- job_positions
CREATE POLICY "job_positions write admin" ON public.job_positions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- permissions
CREATE POLICY "permissions write admin" ON public.permissions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- role_permissions
CREATE POLICY "role_permissions write admin" ON public.role_permissions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- roles
CREATE POLICY "roles write admin" ON public.roles
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- prep_orders — any authenticated user can read; admin full access
CREATE POLICY "prep_orders read authenticated" ON public.prep_orders
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "prep_orders write admin" ON public.prep_orders
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- prep_order_items — any authenticated user can read; admin full access
CREATE POLICY "prep_order_items read authenticated" ON public.prep_order_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "prep_order_items write admin" ON public.prep_order_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- stock_adjustments
CREATE POLICY "stock_adjustments read authenticated" ON public.stock_adjustments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock_adjustments write admin" ON public.stock_adjustments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- stock_counts
CREATE POLICY "stock_counts read authenticated" ON public.stock_counts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock_counts write admin" ON public.stock_counts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- stock_count_items
CREATE POLICY "stock_count_items read authenticated" ON public.stock_count_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock_count_items write admin" ON public.stock_count_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

COMMIT;


-- ────────────────────────────────────────────────────────────
-- 0034_profiles_is_owner.sql
-- ────────────────────────────────────────────────────────────
-- Add is_owner flag to profiles.
-- The account owner cannot be deleted or have their role changed.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false;

-- Prevent deleting the account owner via RLS isn't practical here
-- since deletion goes through service role. Guard is enforced at the app layer.


-- ────────────────────────────────────────────────────────────
-- 0035_fix_handle_new_user_trigger.sql
-- ────────────────────────────────────────────────────────────
-- Fix handle_new_user trigger: role column is now plain text (enum was dropped in 0033).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'staff')
  )
  on conflict (id) do nothing;
  return new;
end
$$;

