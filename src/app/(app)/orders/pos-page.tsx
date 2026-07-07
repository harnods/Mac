import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { PosBillsBoard, type PosBillOrder } from "./pos-bills-board";

export async function OrdersPosPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: ordersData } = await supabase
    .from("orders")
    .select(
      "id, order_number, table_id, table_name_snapshot, customer_name, customer_phone, status, total, created_at, updated_at, order_items(id, name_snapshot, qty, unit_price, line_total, closed_at)",
    )
    .not("table_id", "is", null)
    .in("status", ["new", "preparing", "ready", "completed"])
    .order("updated_at", { ascending: false })
    .limit(160);

  const orders = (ordersData ?? []) as unknown as PosBillOrder[];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">POS</h1>
      <PosBillsBoard initialOrders={orders} />
    </div>
  );
}
