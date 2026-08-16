-- Split Products into its own permission module. Products previously rode on
-- inventory:read / inventory:write; give it dedicated keys so roles can be
-- granted Products access independently of ingredients/supplies/prep items.
INSERT INTO permissions (key, module, action, description) VALUES
  ('products:read',  'products', 'read',  'View products'),
  ('products:write', 'products', 'write', 'Add, edit, delete products')
ON CONFLICT (key) DO NOTHING;

-- Mirror current inventory access so no role loses its existing product access:
-- every role holding inventory:read gets products:read, inventory:write gets
-- products:write. (Super admin keeps full access via code regardless.)
INSERT INTO role_permissions (role_id, permission_key)
SELECT rp.role_id, 'products:read'
FROM role_permissions rp
WHERE rp.permission_key = 'inventory:read'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_key)
SELECT rp.role_id, 'products:write'
FROM role_permissions rp
WHERE rp.permission_key = 'inventory:write'
ON CONFLICT DO NOTHING;
