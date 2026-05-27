export type ItemTypeSlug = 'ingredients' | 'supplies' | 'products' | 'prep-items';
export type CategoryTypeSlug = 'ingredients' | 'supplies' | 'products';
export type ItemTypeDb = 'ingredient' | 'supply' | 'product' | 'prep_item';
export type CategoryTypeDb = 'ingredient' | 'supply' | 'product';

// 'full'      — On hand, Reserved, Available (ingredients, prep-items)
// 'available' — Available only (supplies)
// 'none'      — No stock tracking (products)
export type StockMode = 'full' | 'available' | 'none';

type ItemTypeConfig = {
  dbType: ItemTypeDb;
  label: string;
  singular: string;
  hasCategories: boolean;
  stockMode: StockMode;
  showCost: boolean;
  catSlug: CategoryTypeSlug | null;
};

export const ITEM_TYPE_CONFIG: Record<ItemTypeSlug, ItemTypeConfig> = {
  ingredients:  { dbType: 'ingredient', label: 'Ingredients', singular: 'Ingredient', hasCategories: true,  stockMode: 'full',      showCost: true,  catSlug: 'ingredients' },
  supplies:     { dbType: 'supply',     label: 'Supplies',    singular: 'Supply',     hasCategories: true,  stockMode: 'available', showCost: true,  catSlug: 'supplies' },
  products:     { dbType: 'product',    label: 'Products',    singular: 'Product',    hasCategories: true,  stockMode: 'none',      showCost: false, catSlug: 'products' },
  'prep-items': { dbType: 'prep_item',  label: 'Prep items',  singular: 'Prep item',  hasCategories: false, stockMode: 'available', showCost: false, catSlug: null },
};

type CategoryTypeConfig = {
  dbType: CategoryTypeDb;
  label: string;
  itemSlug: ItemTypeSlug;
};

export const CATEGORY_TYPE_CONFIG: Record<CategoryTypeSlug, CategoryTypeConfig> = {
  ingredients: { dbType: 'ingredient', label: 'Ingredients categories', itemSlug: 'ingredients' },
  supplies:    { dbType: 'supply',     label: 'Supply categories',      itemSlug: 'supplies' },
  products:    { dbType: 'product',    label: 'Product categories',     itemSlug: 'products' },
};

export const ITEM_TYPE_SLUGS = Object.keys(ITEM_TYPE_CONFIG) as ItemTypeSlug[];
export const CATEGORY_TYPE_SLUGS = Object.keys(CATEGORY_TYPE_CONFIG) as CategoryTypeSlug[];

export function dbTypeToItemSlug(dbType: ItemTypeDb): ItemTypeSlug {
  const entry = Object.entries(ITEM_TYPE_CONFIG).find(([, v]) => v.dbType === dbType);
  return (entry?.[0] as ItemTypeSlug) ?? 'ingredients';
}
