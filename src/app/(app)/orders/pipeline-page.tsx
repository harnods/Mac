import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { OrdersBoard, type BoardView, type Order } from "./orders-board";

type Props = {
  view: BoardView;
};

export async function OrdersPipelinePage({ view }: Props) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, customer_name, customer_phone, table_name_snapshot, total, notes, printed_at, created_at, order_items(id, name_snapshot, qty, line_total, item:items!item_id(id, name, categories(name)))",
    )
    .in("status", ["new", "preparing", "ready"])
    .order("created_at", { ascending: true });

  const orders = (data ?? []) as unknown as Order[];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        {view === "bar" ? "Bar pipeline" : "Kitchen pipeline"}
      </h1>
      <OrdersBoard initialOrders={orders} view={view} />
    </div>
  );
}
