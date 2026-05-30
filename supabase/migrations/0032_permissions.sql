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
