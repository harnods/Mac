export type UnitCode = string;
export type UserRole = "admin" | "staff";
export type ItemType = 'ingredient' | 'supply' | 'product' | 'prep_item';
export type CategoryType = 'ingredient' | 'supply' | 'product';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
};

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
  item: Pick<Item, "id" | "name" | "unit"> | null;
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
