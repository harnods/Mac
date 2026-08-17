import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { ManualOrderClient, type ManualCategory, type ManualItem } from "./manual-order-client";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  unit: string;
  sell_price: number | null;
  image_url: string | null;
  categories: { name: string } | null;
};

export default async function ManualOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { table: code } = await searchParams;
  if (!code) redirect("/orders");

  const supabase = await createClient();

  const { data: table } = await supabase
    .from("tables")
    .select("id, name, code")
    .eq("code", code)
    .maybeSingle();

  if (!table) notFound();

  const { data } = await supabase
    .from("items")
    .select("id, name, unit, sell_price, image_url, categories(name)")
    .eq("is_sellable", true)
    .is("deleted_at", null)
    .order("name");

  const rows = (data ?? []) as unknown as Row[];

  const byCategory = new Map<string, ManualItem[]>();
  for (const r of rows) {
    const cat = r.categories?.name ?? "Lainnya";
    const list = byCategory.get(cat) ?? [];
    list.push({ id: r.id, name: r.name, price: Number(r.sell_price ?? 0), imageUrl: r.image_url });
    byCategory.set(cat, list);
  }

  const categories: ManualCategory[] = [...byCategory.entries()]
    .map(([name, items]) => ({ name, items }))
    .sort((a, b) => {
      if (a.name === "Lainnya") return 1;
      if (b.name === "Lainnya") return -1;
      return a.name.localeCompare(b.name);
    });

  return (
    <ManualOrderClient
      categories={categories}
      table={{ id: table.id as string, name: table.name as string, code: table.code as string }}
    />
  );
}
