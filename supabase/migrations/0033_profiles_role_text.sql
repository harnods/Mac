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
