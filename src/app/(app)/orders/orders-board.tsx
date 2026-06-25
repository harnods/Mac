"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRp } from "@/lib/format";
import { updateOrderStatus } from "@/app/actions/orders";

export type Order = {
  id: string;
  order_number: string;
  status: "new" | "preparing" | "ready";
  customer_name: string | null;
  customer_phone: string;
  total: number;
  notes: string | null;
  printed_at: string | null;
  created_at: string;
  order_items: { id: string; name_snapshot: string; qty: number; line_total: number }[];
};

const COLUMNS: { key: Order["status"]; label: string; next: string; nextLabel: string }[] = [
  { key: "new", label: "Baru", next: "preparing", nextLabel: "Siapkan" },
  { key: "preparing", label: "Disiapkan", next: "ready", nextLabel: "Siap" },
  { key: "ready", label: "Siap diambil", next: "completed", nextLabel: "Selesai" },
];

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} mnt lalu`;
  const h = Math.floor(mins / 60);
  return `${h} jam lalu`;
}

export function OrdersBoard({ initialOrders }: { initialOrders: Order[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const knownIds = useRef<Set<string>>(new Set(initialOrders.map((o) => o.id)));

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("orders-board")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          const row = payload.new as { id?: string } | null;
          if (payload.eventType === "INSERT" && row?.id && !knownIds.current.has(row.id)) {
            knownIds.current.add(row.id);
            toast.success("Pesanan baru masuk");
            try {
              const ctx = new AudioContext();
              const osc = ctx.createOscillator();
              osc.frequency.value = 880;
              osc.connect(ctx.destination);
              osc.start();
              osc.stop(ctx.currentTime + 0.15);
            } catch {
              // audio not available — ignore
            }
          }
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  function advance(orderId: string, status: string) {
    startTransition(async () => {
      const res = await updateOrderStatus(orderId, status);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const orders = initialOrders.filter((o) => o.status === col.key);
        return (
          <div key={col.key} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{col.label}</h2>
              <Badge variant="secondary" className="tabular-nums">
                {orders.length}
              </Badge>
            </div>
            <div className="space-y-3">
              {orders.length === 0 && (
                <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                  Kosong
                </div>
              )}
              {orders.map((order) => (
                <div key={order.id} className="rounded-lg border bg-card p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-lg font-bold tabular-nums leading-none">
                        {order.order_number}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {order.customer_name || order.customer_phone}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" /> {timeAgo(order.created_at)}
                    </div>
                  </div>

                  <ul className="space-y-0.5 text-sm">
                    {order.order_items.map((li) => (
                      <li key={li.id} className="flex justify-between gap-2">
                        <span className="min-w-0 truncate">
                          <span className="tabular-nums text-muted-foreground">{li.qty}×</span>{" "}
                          {li.name_snapshot}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {order.notes && (
                    <p className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                      {order.notes}
                    </p>
                  )}

                  <div className="flex items-center justify-between border-t pt-2">
                    <span className="text-sm font-medium tabular-nums">{formatRp(order.total)}</span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs text-muted-foreground"
                        onClick={() => advance(order.id, "cancelled")}
                      >
                        Batal
                      </Button>
                      <Button size="sm" className="h-8 text-xs" onClick={() => advance(order.id, col.next)}>
                        {col.nextLabel}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
