import Link from "next/link";
import { redirect } from "next/navigation";
import { Printer, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { OrdersBoard, type Order } from "./orders-board";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, customer_name, customer_phone, table_name_snapshot, total, notes, printed_at, created_at, order_items(id, name_snapshot, qty, line_total)",
    )
    .in("status", ["new", "preparing", "ready"])
    .order("created_at", { ascending: true });

  const orders = (data ?? []) as unknown as Order[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/orders/bills">
              <Receipt className="size-4" /> Open Bills
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/orders/print-station">
              <Printer className="size-4" /> Print station
            </Link>
          </Button>
        </div>
      </div>
      <OrdersBoard initialOrders={orders} />
    </div>
  );
}
