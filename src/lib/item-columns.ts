import type { ColumnDef } from "@/hooks/use-column-visibility";
import type { StockMode } from "@/lib/item-types";

export type ItemColumnFlags = {
  showBrand?: boolean;
  showCategory: boolean;
  showLocation?: boolean;
  stockMode: StockMode;
  showCost: boolean;
  showSellable?: boolean;
  showDefaultCost?: boolean;
  hasRecipeColumn?: boolean;
};

/** The set of user-toggleable columns for a given item type's list table. */
export function getItemColumns(flags: ItemColumnFlags): ColumnDef[] {
  const cols: ColumnDef[] = [];
  if (flags.showBrand) cols.push({ key: "brand", label: "Brand" });
  if (flags.showCategory) cols.push({ key: "category", label: "Category" });
  if (flags.showLocation) cols.push({ key: "location", label: "Location" });
  if (flags.stockMode === "full") cols.push({ key: "onHand", label: "On hand" });
  if (flags.stockMode === "full") cols.push({ key: "reserved", label: "Reserved" });
  if (flags.stockMode !== "none") cols.push({ key: "available", label: "Available" });
  if (flags.showCost) cols.push({ key: "lastCost", label: "Last cost" });
  if (flags.showCost) cols.push({ key: "avgCost", label: "Avg. cost" });
  if (flags.showDefaultCost) cols.push({ key: "defaultCost", label: "Default cost" });
  if (flags.showSellable) cols.push({ key: "sellable", label: "Sellable" });
  if (flags.showSellable) cols.push({ key: "sellingPrice", label: "Selling price" });
  if (flags.showSellable) cols.push({ key: "addOn", label: "Add-on" });
  if (flags.hasRecipeColumn) cols.push({ key: "recipe", label: "Recipe" });
  cols.push({ key: "lastUpdated", label: "Last updated", defaultHidden: true });
  return cols;
}
