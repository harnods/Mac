// Permission key constants — use these everywhere instead of bare strings
export const P = {
  INVENTORY_READ:       'inventory:read',
  INVENTORY_WRITE:      'inventory:write',
  PRODUCTS_READ:        'products:read',
  PRODUCTS_WRITE:       'products:write',
  RECIPES_READ:         'recipes:read',
  RECIPES_WRITE:        'recipes:write',
  RECIPES_BAR:          'recipes:bar',
  RECIPES_KITCHEN:      'recipes:kitchen',
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

// The built-in super-admin role. It always holds every permission (including
// ones added in future) and its permission set can't be edited or unchecked.
export const ADMIN_ROLE_NAME = 'admin';
export const ALL_PERMISSION_KEYS: PermissionKey[] = Object.values(P);

/** Whether a role name is the all-access admin role. */
export function isSuperRole(roleName: string | null | undefined): boolean {
  return roleName === ADMIN_ROLE_NAME;
}

/**
 * Human-facing label for a role. The built-in admin role keeps the stable
 * internal identifier `admin` (referenced by RLS policies and grant flows) but
 * is shown to users as "Super admin".
 */
export function roleLabel(roleName: string | null | undefined): string {
  if (!roleName) return "—";
  return isSuperRole(roleName) ? "Super admin" : roleName;
}

// Groups for the settings UI
export const PERMISSION_MODULES = [
  { module: 'inventory',   label: 'Inventory',   keys: [P.INVENTORY_READ, P.INVENTORY_WRITE] },
  { module: 'products',    label: 'Products',    keys: [P.PRODUCTS_READ, P.PRODUCTS_WRITE] },
  { module: 'recipes',     label: 'Recipes',     keys: [P.RECIPES_READ, P.RECIPES_WRITE, P.RECIPES_BAR, P.RECIPES_KITCHEN] },
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
  'products:read':        'View',
  'products:write':       'Add / edit / delete',
  'recipes:read':         'View',
  'recipes:write':        'Add / edit / delete',
  'recipes:bar':          'Limit to Bar recipes',
  'recipes:kitchen':      'Limit to Kitchen recipes',
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

/**
 * Item write/read is governed by two modules: Products has its own permission,
 * everything else (ingredients, supplies, prep items) falls under Inventory.
 * `dbType` is the item's `type` column ('product' | 'ingredient' | 'supply' |
 * 'prep_item'). Use these so a page/action picks the right permission by type.
 */
export function itemWritePermission(dbType: string | null | undefined): PermissionKey {
  return dbType === 'product' ? P.PRODUCTS_WRITE : P.INVENTORY_WRITE;
}
export function itemReadPermission(dbType: string | null | undefined): PermissionKey {
  return dbType === 'product' ? P.PRODUCTS_READ : P.INVENTORY_READ;
}
export function canWriteItemType(
  profile: { permissions: string[] } | null | undefined,
  dbType: string | null | undefined,
): boolean {
  return can(profile, itemWritePermission(dbType));
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

/**
 * Whether a profile may view cost / COGS / margin information anywhere in the
 * app. Cost is confidential and restricted to the built-in Super admin role
 * across every module (inventory costs, recipe COGS, recorded purchase prices).
 * Note: this is intentionally role-based, not a grantable permission key —
 * cost visibility can't be delegated to other roles.
 */
export function canViewCost(
  profile: { role?: string | null } | null | undefined,
): boolean {
  return isSuperRole(profile?.role);
}

export type RecipeStationKey = 'bar' | 'kitchen';

/**
 * Which recipe stations a profile is limited to.
 * `null` means no limit — all recipes are visible. This is the case for the
 * account owner and for any role that grants neither (or both) station keys,
 * which keeps existing roles working unchanged. Granting exactly one of
 * `recipes:bar` / `recipes:kitchen` scopes the role to that station only.
 */
export function allowedRecipeStations(
  profile: { is_owner?: boolean; permissions: string[] } | null | undefined,
): RecipeStationKey[] | null {
  if (!profile) return [];
  if (profile.is_owner) return null;
  const bar = can(profile, P.RECIPES_BAR);
  const kitchen = can(profile, P.RECIPES_KITCHEN);
  if (bar === kitchen) return null; // neither or both -> no limit
  return bar ? ['bar'] : ['kitchen'];
}

/**
 * Whether a profile may access a recipe of the given station.
 * Uncategorized recipes (`station == null`) are visible to everyone since they
 * belong to neither Bar nor Kitchen.
 */
export function canAccessRecipeStation(
  profile: { is_owner?: boolean; permissions: string[] } | null | undefined,
  station: string | null,
): boolean {
  const allowed = allowedRecipeStations(profile);
  if (allowed === null) return true;
  if (station == null) return true;
  return allowed.includes(station as RecipeStationKey);
}
