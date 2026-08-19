-- The daily stock count feature added RLS policies referencing
-- has_permission('daily_stock_counts:read'/'write') but never seeded the two
-- keys into the permissions catalog. Granting them from Settings > Roles then
-- failed validation ("Unknown permission(s)"). Seed the catalog here.
INSERT INTO permissions (key, module, action, description) VALUES
 ('daily_stock_counts:read','daily_stock_counts','read','View daily stock counts'),
 ('daily_stock_counts:write','daily_stock_counts','write','Manage daily stock counts')
ON CONFLICT (key) DO NOTHING;
