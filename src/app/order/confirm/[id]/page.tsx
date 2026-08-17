import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/service";
import { Button } from "@/components/ui/button";
import { formatRp } from "@/lib/format";
import { formatRate, PBJT_RATE, SERVICE_CHARGE_RATE } from "@/lib/order-charges";
import { PointsClaim } from "@/components/order/points-claim";

export const dynamic = "force-dynamic";

type OrderRow = {
  order_number: string;
  customer_name: string | null;
  table_name_snapshot: string | null;
  subtotal: number;
  service_charge: number;
  tax_total: number;
  total: number;
  points_earned: number | null;
  points_claimed_at: string | null;
  loyalty_ig_handle: string | null;
  points_void: boolean;
  order_items: { id: string; name_snapshot: string; qty: number; line_total: number }[];
  tables: { code: string } | null;
};

export default async function ConfirmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("orders")
    .select("order_number, customer_name, table_name_snapshot, subtotal, service_charge, tax_total, total, points_earned, points_claimed_at, loyalty_ig_handle, points_void, order_items(id, name_snapshot, qty, line_total), tables(code)")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const order = data as unknown as OrderRow;

  return (
    <div className="flex flex-1 flex-col px-6 py-10 gap-6">
      <div className="flex flex-col items-center text-center space-y-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/machimoto-logotype.svg" alt="Machimoto" className="h-6 w-auto" />
        <CheckCircle2 className="size-14 text-green-600" />
        <h1 className="text-2xl font-semibold tracking-tight">Order received</h1>
        <p className="text-sm text-muted-foreground">
          {order.customer_name ? `Thank you, ${order.customer_name}. ` : ""}
          Your order is being prepared.
        </p>
        {order.table_name_snapshot && (
          <p className="text-sm font-medium">{order.table_name_snapshot}</p>
        )}
        <div className="mt-2 rounded-lg bg-muted px-6 py-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Order no.</div>
          <div className="text-3xl font-bold tabular-nums tracking-tight">{order.order_number}</div>
        </div>
      </div>

      <div className="divide-y rounded-lg border">
        {order.order_items.map((li) => (
          <div key={li.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span className="min-w-0 truncate">
              <span className="tabular-nums text-muted-foreground">{li.qty}×</span> {li.name_snapshot}
            </span>
            <span className="tabular-nums">{formatRp(li.line_total)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatRp(order.subtotal)}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span>Service charge ({formatRate(SERVICE_CHARGE_RATE)})</span>
          <span className="tabular-nums">{formatRp(order.service_charge)}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span>PBJT ({formatRate(PBJT_RATE)})</span>
          <span className="tabular-nums">{formatRp(order.tax_total)}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatRp(order.total)}</span>
        </div>
      </div>

      {(order.points_earned ?? 0) > 0 && (
        <PointsClaim
          orderId={id}
          points={order.points_earned!}
          alreadyClaimed={!!order.points_claimed_at}
          claimedByIg={order.loyalty_ig_handle ?? null}
          pointsVoid={order.points_void}
        />
      )}

      <Button asChild variant="outline" className="h-12">
        <Link href={order.tables?.code ? `/order/t/${order.tables.code}` : "/order"}>
          Order again
        </Link>
      </Button>
    </div>
  );
}
