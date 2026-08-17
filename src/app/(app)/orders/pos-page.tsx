import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { PosBillsBoard, type PosBillOrder, type PosTable } from "./pos-bills-board";

export async function OrdersPosPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const [{ data: ordersData }, { data: tablesData }, { data: methodsData }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_number, table_id, table_name_snapshot, customer_name, customer_phone, status, total, created_at, updated_at, order_items(id, name_snapshot, qty, unit_price, line_total, closed_at)",
      )
      .not("table_id", "is", null)
      .in("status", ["new", "preparing", "ready", "completed"])
      .order("updated_at", { ascending: false })
      .limit(160),
    supabase.from("tables").select("id, name, code").order("created_at", { ascending: true }),
    supabase.from("payment_methods").select("name").order("name"),
  ]);

  const orders = (ordersData ?? []) as unknown as PosBillOrder[];
  const tables = (tablesData ?? []) as unknown as PosTable[];
  const paymentMethods = ((methodsData ?? []) as { name: string }[]).map((m) => m.name);

  return (
    <div className="space-y-4">
      <PosBillsBoard initialOrders={orders} tables={tables} paymentMethods={paymentMethods} />
    </div>
  );
}
