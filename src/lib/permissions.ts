// Permission key constants — use these everywhere instead of bare strings
export const P = {
  INVENTORY_READ:       'inventory:read',
  INVENTORY_WRITE:      'inventory:write',
  RECIPES_READ:         'recipes:read',
  RECIPES_WRITE:        'recipes:write',
  PREP_ORDERS_READ:     'prep_orders:read',
  PREP_ORDERS_WRITE:    'prep_orders:write',
  PREP_ORDERS_COMPLETE: 'prep_orders:complete',
  SALES_READ:           'sales:read',
  SALES_WRITE:          'sales:write',
  PURCHASING_READ:      'purchasing:read',
  PURCHASING_REQUEST:   'purchasing:request',
  PURCHASING_PURCHASE:  'purchasing:purchase',
  PURCHASING_APPROVE:   'purchasing:approve',
  STOCK_READ:           'stock:read',
  STOCK_WRITE:          'stock:write',
  EMPLOYEES_READ:       'employees:read',
  EMPLOYEES_WRITE:      'employees:write',
  EMPLOYEES_ACCESS:     'employees:access',
  EMPLOYEES_COMPENSATION: 'employees:compensation',
  SETTINGS_ROLES:       'settings:roles',
} as const;

export type PermissionKey = typeof P[keyof typeof P];

// Groups for the settings UI
export const PERMISSION_MODULES = [
  { module: 'inventory',   label: 'Inventory',   keys: [P.INVENTORY_READ, P.INVENTORY_WRITE] },
  { module: 'recipes',     label: 'Recipes',     keys: [P.RECIPES_READ, P.RECIPES_WRITE] },
  { module: 'prep_orders', label: 'Prep Orders', keys: [P.PREP_ORDERS_READ, P.PREP_ORDERS_WRITE, P.PREP_ORDERS_COMPLETE] },
  { module: 'sales',       label: 'Sales',       keys: [P.SALES_READ, P.SALES_WRITE] },
  { module: 'purchasing',  label: 'Purchasing',  keys: [P.PURCHASING_READ, P.PURCHASING_REQUEST, P.PURCHASING_PURCHASE, P.PURCHASING_APPROVE] },
  { module: 'stock',       label: 'Stock',       keys: [P.STOCK_READ, P.STOCK_WRITE] },
  { module: 'employees',   label: 'Employees',   keys: [P.EMPLOYEES_READ, P.EMPLOYEES_WRITE, P.EMPLOYEES_ACCESS, P.EMPLOYEES_COMPENSATION] },
  { module: 'settings',    label: 'Settings',    keys: [P.SETTINGS_ROLES] },
] as const;

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  'inventory:read':       'View',
  'inventory:write':      'Add / edit / delete',
  'recipes:read':         'View',
  'recipes:write':        'Add / edit / delete',
  'prep_orders:read':     'View',
  'prep_orders:write':    'Create & cancel',
  'prep_orders:complete': 'Complete (triggers stock)',
  'sales:read':           'View',
  'sales:write':          'Create & edit',
  'purchasing:read':      'View',
  'purchasing:request':   'Create requests',
  'purchasing:purchase':  'Record purchases',
  'purchasing:approve':   'Approve / reject',
  'stock:read':           'View',
  'stock:write':          'Adjustments & counts',
  'employees:read':       'View',
  'employees:write':      'Add / edit / delete',
  'employees:access':     'Grant / revoke login',
  'employees:compensation': 'View compensation (salary)',
  'settings:roles':       'Manage roles',
};

/** True if the profile has the given permission. Safe with null profile. */
export function can(
  profile: { permissions: string[] } | null | undefined,
  key: PermissionKey,
): boolean {
  return !!profile && profile.permissions.includes(key);
}

// Accounts temporarily denied access to the HR module (regardless of role).
export const HR_BLOCKED_EMAILS = ["ian@machimoto.local"];

/** Whether a profile may access the HR module. */
export function canAccessHr(
  profile: { email: string; is_owner: boolean; permissions: string[] } | null | undefined,
): boolean {
  if (!profile) return false;
  if (HR_BLOCKED_EMAILS.includes(profile.email)) return false;
  return !!profile.is_owner || can(profile, P.EMPLOYEES_READ);
}
