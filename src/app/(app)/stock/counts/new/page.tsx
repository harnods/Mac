import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CountForm } from "@/components/stock/count-form";

export const dynamic = "force-dynamic";

type CompletedCount = {
  count_date: string;
  completed_at: string | null;
  stock_count_items: { item_id: string }[];
};

type CountIngredient = {
  id: string;
  name: string;
  unit: string;
  type: string;
  on_hand: number;
  category_id: string | null;
  categories: { id: string; name: string } | null;
};

export default async function NewStockCountPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!can(profile, P.STOCK_WRITE)) redirect("/stock/counts");

  const supabase = await createClient();

  const [{ data: items }, { data: categories }, { data: completedCounts }] = await Promise.all([
    supabase
      .from("items")
      .select("id, name, unit, type, on_hand, category_id, categories(id,name)")
      .is("deleted_at", null)
      .eq("type", "ingredient")
      .order("name"),
    supabase
      .from("categories")
      .select("id, name")
      .eq("type", "ingredient")
      .order("name"),
    supabase
      .from("stock_counts")
      .select("count_date, completed_at, stock_count_items(item_id)")
      .eq("status", "completed")
      .order("completed_at", { ascending: false, nullsFirst: false })
      .order("count_date", { ascending: false }),
  ]);

  const lastCountedByItem = new Map<string, string>();
  for (const count of ((completedCounts ?? []) as unknown as CompletedCount[])) {
    const timestamp = count.completed_at ?? count.count_date;
    for (const row of count.stock_count_items ?? []) {
      if (!lastCountedByItem.has(row.item_id)) {
        lastCountedByItem.set(row.item_id, timestamp);
      }
    }
  }

  const itemsWithLastCount = ((items ?? []) as unknown as CountIngredient[]).map((item) => ({
    ...item,
    last_counted_at: lastCountedByItem.get(item.id) ?? null,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2 mt-0.5">
          <Link href="/stock/counts">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">New cycle count</h1>
      </div>
      <CountForm items={itemsWithLastCount} categories={categories ?? []} />
    </div>
  );
}
