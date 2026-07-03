import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BillsClient } from "./bills-client";

export const dynamic = "force-dynamic";

export default async function BillsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("table_id, table_name_snapshot, total, status")
    .not("table_id", "is", null)
    .in("status", ["new", "preparing", "ready"]);

  type Row = { table_id: string; table_name_snapshot: string; total: number; status: string };
  const orders = (data ?? []) as unknown as Row[];

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Open Bills</h1>
      <BillsClient initialOrders={orders} />
    </div>
  );
}
