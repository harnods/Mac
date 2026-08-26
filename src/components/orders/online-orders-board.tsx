"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { setOnlineOrderStatus, type AdminOnlineOrder } from "@/app/actions/online-order";

const rp = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;

const STATUS: Record<string, { label: string; className: string }> = {
  pending_payment: { label: "Awaiting payment", className: "bg-stone-100 text-stone-600" },
  paid: { label: "Paid", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  preparing: { label: "Preparing", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  ready: { label: "Ready", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  picked_up: { label: "Picked up", className: "bg-stone-100 text-stone-500" },
  cancelled: { label: "Cancelled", className: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" },
};

const NEXT: Record<string, { to: AdminOnlineOrder["status"]; label: string } | null> = {
  paid: { to: "preparing", label: "Start preparing" },
  preparing: { to: "ready", label: "Mark ready" },
  ready: { to: "picked_up", label: "Mark picked up" },
};

const TABS = [
  { key: "active", label: "Active" },
  { key: "picked_up", label: "Completed" },
  { key: "all", label: "All" },
] as const;

export function OnlineOrdersBoard({ orders }: { orders: AdminOnlineOrder[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("active");

  // Auto-refresh so newly paid orders show up for the kitchen.
  useEffect(() => {
    const iv = setInterval(() => router.refresh(), 12000);
    return () => clearInterval(iv);
  }, [router]);

  const shown = orders.filter((o) => {
    if (tab === "all") return true;
    if (tab === "picked_up") return o.status === "picked_up" || o.status === "cancelled";
    return ["paid", "preparing", "ready"].includes(o.status); // active
  });

  function advance(o: AdminOnlineOrder, to: AdminOnlineOrder["status"], label: string) {
    start(async () => {
      const res = await setOnlineOrderStatus(o.id, to);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(label);
      router.refresh();
    });
  }

  const activeCount = orders.filter((o) => ["paid", "preparing", "ready"].includes(o.status)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${tab === t.key ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}{t.key === "active" && activeCount > 0 ? ` (${activeCount})` : ""}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => router.refresh()}><RefreshCw className="size-4" /> Refresh</Button>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">No orders here.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((o) => {
            const meta = STATUS[o.status];
            const next = NEXT[o.status];
            return (
              <div key={o.id} className="flex flex-col rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-bold tracking-wider">{o.pickup_code}</span>
                      <Badge variant="secondary" className={meta.className}>{meta.label}</Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{o.order_number} · {formatDateTime(o.created_at)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold tabular-nums">{rp(o.total)}</div>
                  </div>
                </div>

                <div className="mt-2 text-sm">
                  <span className="font-medium">{o.customer_name}</span>
                  <span className="text-muted-foreground"> · {o.customer_phone}</span>
                </div>

                <ul className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                  {o.items.map((it) => (
                    <li key={it.id}><span className="font-medium tabular-nums text-foreground">{it.qty}×</span> {it.name_snapshot}</li>
                  ))}
                </ul>
                {o.note && <div className="mt-2 rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">Note: {o.note}</div>}

                {(next || o.status === "paid" || o.status === "preparing") && (
                  <div className="mt-3 flex gap-2 border-t pt-3">
                    {next && (
                      <Button size="sm" disabled={pending} onClick={() => advance(o, next.to, next.label)} className="flex-1">{next.label}</Button>
                    )}
                    {(o.status === "paid" || o.status === "preparing") && (
                      <Button size="sm" variant="ghost" disabled={pending} className="text-destructive hover:text-destructive" onClick={() => advance(o, "cancelled", "Order cancelled")}>Cancel</Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
