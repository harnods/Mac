import { createServiceClient } from "@/lib/supabase/service";
import type { MenuCategory, MenuItem, MenuAddon } from "@/app/order/menu/menu-client";

type Row = {
  id: string;
  name: string;
  unit: string;
  sell_price: number | null;
  image_url: string | null;
  description: string | null;
  is_addon: boolean;
  categories: { name: string } | null;
};

/**
 * Public menu for the customer ordering flow: sellable products grouped by
 * category, plus the global add-ons (is_addon) offered as optional extras.
 */
export async function loadMenu(): Promise<{ categories: MenuCategory[]; addons: MenuAddon[] }> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("items")
    .select("id, name, unit, sell_price, image_url, description, is_addon, categories(name)")
    .eq("is_sellable", true)
    .is("deleted_at", null)
    .order("name");

  const rows = (data ?? []) as unknown as Row[];
  const addons: MenuAddon[] = [];
  const byCategory = new Map<string, MenuItem[]>();

  for (const r of rows) {
    const price = Number(r.sell_price ?? 0);
    if (r.is_addon) {
      addons.push({ id: r.id, name: r.name, price });
      continue;
    }
    const cat = r.categories?.name ?? "Lainnya";
    const list = byCategory.get(cat) ?? [];
    list.push({ id: r.id, name: r.name, unit: r.unit, price, imageUrl: r.image_url, description: r.description });
    byCategory.set(cat, list);
  }

  const categories: MenuCategory[] = [...byCategory.entries()]
    .map(([name, items]) => ({ name, items }))
    .sort((a, b) => {
      if (a.name === "Lainnya") return 1;
      if (b.name === "Lainnya") return -1;
      return a.name.localeCompare(b.name);
    });

  return { categories, addons };
}
