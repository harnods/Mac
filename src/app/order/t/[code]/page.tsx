import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { MenuClient, type MenuCategory, type MenuItem } from "@/app/order/menu/menu-client";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  unit: string;
  sell_price: number | null;
  image_url: string | null;
  categories: { name: string } | null;
};

export default async function TableOrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = createServiceClient();

  const { data: tableData } = await supabase
    .from("tables")
    .select("id, name, code")
    .eq("code", code)
    .maybeSingle();

  if (!tableData) notFound();

  const { data } = await supabase
    .from("items")
    .select("id, name, unit, sell_price, image_url, categories(name)")
    .eq("is_sellable", true)
    .is("deleted_at", null)
    .order("name");

  const rows = (data ?? []) as unknown as Row[];

  const byCategory = new Map<string, MenuItem[]>();
  for (const r of rows) {
    const cat = r.categories?.name ?? "Lainnya";
    const list = byCategory.get(cat) ?? [];
    list.push({ id: r.id, name: r.name, unit: r.unit, price: Number(r.sell_price ?? 0), imageUrl: r.image_url });
    byCategory.set(cat, list);
  }

  const categories: MenuCategory[] = [...byCategory.entries()]
    .map(([name, items]) => ({ name, items }))
    .sort((a, b) => {
      if (a.name === "Lainnya") return 1;
      if (b.name === "Lainnya") return -1;
      return a.name.localeCompare(b.name);
    });

  return (
    <MenuClient
      categories={categories}
      table={{ id: tableData.id as string, name: tableData.name as string, code: tableData.code as string }}
    />
  );
}
