-- Split the single Inventory/Stock permissions into per-sub-module View/Manage
-- pairs. Seed the catalog and expand existing role grants to preserve behavior.
INSERT INTO permissions (key, module, action, description) VALUES
 ('ingredients:read','ingredients','read','View ingredients'),
 ('ingredients:write','ingredients','write','Manage ingredients'),
 ('assets:read','assets','read','View assets'),
 ('assets:write','assets','write','Manage assets'),
 ('prep_items:read','prep_items','read','View prep items'),
 ('prep_items:write','prep_items','write','Manage prep items'),
 ('products:read','products','read','View products'),
 ('products:write','products','write','Manage products'),
 ('categories:read','categories','read','View categories'),
 ('categories:write','categories','write','Manage categories'),
 ('units:read','units','read','View units'),
 ('units:write','units','write','Manage units'),
 ('locations:read','locations','read','View locations'),
 ('locations:write','locations','write','Manage locations'),
 ('stock_adjustments:read','stock_adjustments','read','View stock adjustments'),
 ('stock_adjustments:write','stock_adjustments','write','Create stock adjustments'),
 ('stock_counts:read','stock_counts','read','View stock counts'),
 ('stock_counts:write','stock_counts','write','Manage stock counts')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_key)
SELECT rp.role_id, k.key FROM role_permissions rp
CROSS JOIN (VALUES ('ingredients:read'),('assets:read'),('prep_items:read'),('products:read'),('categories:read'),('units:read'),('locations:read')) AS k(key)
WHERE rp.permission_key = 'inventory:read' ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_key)
SELECT rp.role_id, k.key FROM role_permissions rp
CROSS JOIN (VALUES ('ingredients:write'),('assets:write'),('prep_items:write'),('products:write'),('categories:write'),('units:write'),('locations:write')) AS k(key)
WHERE rp.permission_key = 'inventory:write' ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_key)
SELECT rp.role_id, k.key FROM role_permissions rp
CROSS JOIN (VALUES ('stock_adjustments:read'),('stock_counts:read')) AS k(key)
WHERE rp.permission_key = 'stock:read' ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_key)
SELECT rp.role_id, k.key FROM role_permissions rp
CROSS JOIN (VALUES ('stock_adjustments:write'),('stock_counts:write')) AS k(key)
WHERE rp.permission_key = 'stock:write' ON CONFLICT DO NOTHING;
