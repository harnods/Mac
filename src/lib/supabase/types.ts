export type UnitCode = string;
export type UserRole = string; // any role name — defined in the roles table
export type ItemType = 'ingredient' | 'supply' | 'product' | 'prep_item';
export type CategoryType = 'ingredient' | 'supply' | 'product';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_owner: boolean;
  created_at: string;
};

export type ProfileWithPermissions = Profile & { permissions: string[] };

export type Updater = Pick<Profile, "full_name" | "email">;

export type Category = {
  id: string;
  name: string;
  type: CategoryType;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

export type CategoryWithUpdater = Category & {
  updater: Updater | null;
};

export type Item = {
  id: string;
  name: string;
  category_id: string | null;
  unit: UnitCode;
  type: ItemType;
  on_hand: number;
  reserved: number;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  last_purchase_cost: number | null;
  avg_purchase_cost: number | null;
  deleted_at: string | null;
  is_sellable: boolean;
  sell_price: number | null;
  is_addon: boolean;
};

export type ItemWithCategory = Item & {
  categories: Pick<Category, "id" | "name"> | null;
  updater: Updater | null;
};

export type Recipe = {
  id: string;
  name: string;
  product_id: string | null;
  yield_qty: number;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

export type RecipeItem = {
  id: string;
  recipe_id: string;
  item_id: string;
  quantity: number;
  unit: UnitCode;
  created_at: string;
};

export type RecipeItemWithItem = RecipeItem & {
  item: Pick<Item, "id" | "name" | "unit" | "deleted_at"> | null;
};

export type PurchaseRequestStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export type PurchaseRequest = {
  id: string;
  status: PurchaseRequestStatus;
  note: string | null;
  created_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

export type PurchaseRequestItem = {
  id: string;
  request_id: string;
  item_id: string;
  qty: number;
  unit: string;
  created_at: string;
};

export type PurchaseRequestItemWithItem = PurchaseRequestItem & {
  item: Pick<Item, 'id' | 'name' | 'unit' | 'on_hand' | 'reserved'> | null;
};

export type PurchaseRequestWithItems = PurchaseRequest & {
  purchase_request_items: PurchaseRequestItemWithItem[];
  creator: Updater | null;
  reviewer: Updater | null;
};

export type Purchase = {
  id: string;
  note: string | null;
  transaction_date: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

export type PurchaseItem = {
  id: string;
  purchase_id: string;
  item_id: string;
  qty_requested: number | null;
  requested_unit: string | null;
  qty_purchased: number;
  unit: string;
  cost_per_unit: number | null;
  cost_total: number | null;
  row_note: string | null;
  created_at: string;
};

export type PurchaseItemWithItem = PurchaseItem & {
  item: Pick<Item, 'id' | 'name' | 'unit'> | null;
};

export type PurchaseWithItems = Purchase & {
  purchase_items: PurchaseItemWithItem[];
  updater: Updater | null;
  purchase_request: Pick<PurchaseRequest, 'id'> | null;
};

export type RecipeWithItems = Recipe & {
  recipe_items: RecipeItemWithItem[];
  updater: Updater | null;
  product: Pick<Item, "id" | "name" | "unit"> | null;
};

// ─── Employees ────────────────────────────────────────────────────────────────

export type Department = {
  id: string;
  name: string;
  updated_by: string | null;
  updated_at: string;
};

export type JobPosition = {
  id: string;
  name: string;
  updated_by: string | null;
  updated_at: string;
};

export type EmploymentStatus = {
  id: string;
  name: string;
  updated_by: string | null;
  updated_at: string;
};

export type JobLevel = {
  id: string;
  name: string;
  sort_order: number;
  updated_by: string | null;
  updated_at: string;
};

export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type Gender = 'male' | 'female';

export type Employee = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  birthdate: string | null;
  nik: string | null;
  address: string | null;
  marital_status: MaritalStatus | null;
  gender: Gender | null;
  department_id: string | null;
  job_position_id: string | null;
  job_level_id: string | null;
  employment_status_id: string | null;
  user_id: string | null;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
  deleted_at: string | null;
};

export type EmployeeWithRelations = Employee & {
  departments: Pick<Department, 'id' | 'name'> | null;
  job_positions: Pick<JobPosition, 'id' | 'name'> | null;
  job_levels: Pick<JobLevel, 'id' | 'name'> | null;
  employment_statuses: Pick<EmploymentStatus, 'id' | 'name'> | null;
  mac_user: Pick<Profile, 'id' | 'email' | 'role' | 'is_owner'> | null;
  updater: Updater | null;
};
