import { createServiceClient } from "@/lib/supabase/service";
import { MenuClient, type MenuCategory, type MenuItem } from "./menu-client";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  unit: string;
  sell_price: number | null;
  image_url: string | null;
  categories: { name: string } | null;
};

export default async function MenuPage() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("items")
    .select("id, name, unit, sell_price, image_url, categories(name)")
    .eq("is_sellable", true)
    .is("deleted_at", null)
    .order("name");

  const rows = (data ?? []) as unknown as Row[];

  // Group by category name; uncategorised last.
  const byCategory = new Map<string, MenuItem[]>();
  for (const r of rows) {
    const cat = r.categories?.name ?? "Lainnya";
    const list = byCategory.get(cat) ?? [];
    list.push({
      id: r.id,
      name: r.name,
      unit: r.unit,
      price: Number(r.sell_price ?? 0),
      imageUrl: r.image_url,
    });
    byCategory.set(cat, list);
  }

  const categories: MenuCategory[] = [...byCategory.entries()]
    .map(([name, items]) => ({ name, items }))
    .sort((a, b) => {
      if (a.name === "Lainnya") return 1;
      if (b.name === "Lainnya") return -1;
      return a.name.localeCompare(b.name);
    });

  return <MenuClient categories={categories} />;
}
