-- Register the recipe station-scope permission keys (and the missing
-- compensation key) in the permissions catalog so they can be granted to roles.
INSERT INTO permissions (key, module, action, description) VALUES
  ('recipes:bar', 'recipes', 'bar', 'Limit recipe access to Bar recipes'),
  ('recipes:kitchen', 'recipes', 'kitchen', 'Limit recipe access to Kitchen recipes'),
  ('employees:compensation', 'employees', 'compensation', 'View employee compensation (salary)')
ON CONFLICT (key) DO NOTHING;
