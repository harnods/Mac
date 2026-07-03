"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatRp } from "@/lib/format";
import { closeTableBill } from "@/app/actions/orders";

type OpenOrder = {
  table_id: string;
  table_name_snapshot: string;
  total: number;
  status: string;
};

type TableBill = {
  tableId: string;
  tableName: string;
  orderCount: number;
  total: number;
  statuses: string[];
};

type OrderDetail = {
  id: string;
  order_number: string;
  total: number;
  order_items: { name_snapshot: string; qty: number; unit_price: number; line_total: number }[];
};

function groupByTable(orders: OpenOrder[]): TableBill[] {
  const map = new Map<string, TableBill>();
  for (const o of orders) {
    const existing = map.get(o.table_id);
    if (existing) {
      existing.orderCount++;
      existing.total += o.total;
      if (!existing.statuses.includes(o.status)) existing.statuses.push(o.status);
    } else {
      map.set(o.table_id, {
        tableId: o.table_id,
        tableName: o.table_name_snapshot,
        orderCount: 1,
        total: o.total,
        statuses: [o.status],
      });
    }
  }
  return [...map.values()].sort((a, b) => a.tableName.localeCompare(b.tableName));
}

export function BillsClient({ initialOrders }: { initialOrders: OpenOrder[] }) {
  const router = useRouter();
  const [bills, setBills] = useState<TableBill[]>(groupByTable(initialOrders));
  const [closing, startClose] = useTransition();
  const [selectedBill, setSelectedBill] = useState<TableBill | null>(null);
  const [orderDetails, setOrderDetails] = useState<OrderDetail[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const supabase = useRef(createClient());

  useEffect(() => {
    const channel = supabase.current
      .channel("bills-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        router.refresh();
      })
      .subscribe();
    return () => { supabase.current.removeChannel(channel); };
  }, [router]);

  useEffect(() => {
    setBills(groupByTable(initialOrders));
  }, [initialOrders]);

  async function openBillDialog(bill: TableBill) {
    setSelectedBill(bill);
    setLoadingDetails(true);
    const { data } = await supabase.current
      .from("orders")
      .select("id, order_number, total, order_items(name_snapshot, qty, unit_price, line_total)")
      .eq("table_id", bill.tableId)
      .in("status", ["new", "preparing", "ready"])
      .order("created_at", { ascending: true });
    setOrderDetails((data ?? []) as unknown as OrderDetail[]);
    setLoadingDetails(false);
  }

  function confirmClose() {
    if (!selectedBill) return;
    const { tableId, tableName } = selectedBill;
    startClose(async () => {
      const res = await closeTableBill(tableId);
      if (!res.ok) {
        toast.error(res.error);
      } else {
        toast.success(`Bill ${tableName} ditutup`);
        setSelectedBill(null);
        router.refresh();
      }
    });
  }

  if (bills.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        Tidak ada bill yang terbuka.
      </div>
    );
  }

  const grandTotal = orderDetails.reduce((s, o) => s + o.total, 0);

  return (
    <>
      <div className="divide-y rounded-lg border">
        {bills.map((bill) => (
          <div key={bill.tableId} className="flex items-center justify-between gap-4 px-4 py-4">
            <div className="min-w-0">
              <div className="font-semibold">{bill.tableName}</div>
              <div className="text-sm text-muted-foreground">
                {bill.orderCount} pesanan ·{" "}
                {bill.statuses.map((s) => (
                  <Badge key={s} variant="secondary" className="mr-1 text-xs capitalize">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-lg font-bold tabular-nums">{formatRp(bill.total)}</span>
              <Button size="sm" onClick={() => openBillDialog(bill)}>
                Close Bill
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!selectedBill} onOpenChange={(open) => { if (!open) setSelectedBill(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedBill?.tableName} — Summary</DialogTitle>
          </DialogHeader>

          {loadingDetails ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Memuat...</div>
          ) : (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {orderDetails.map((order, i) => (
                <div key={order.id} className="space-y-1">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Pesanan #{i + 1} · {order.order_number}
                  </div>
                  {order.order_items.map((item, j) => (
                    <div key={j} className="flex justify-between text-sm gap-2">
                      <span className="text-muted-foreground tabular-nums">{item.qty}×</span>
                      <span className="flex-1">{item.name_snapshot}</span>
                      <span className="tabular-nums">{formatRp(item.line_total)}</span>
                    </div>
                  ))}
                </div>
              ))}

              <Separator />

              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span className="tabular-nums">{formatRp(grandTotal)}</span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedBill(null)}>
              Batal
            </Button>
            <Button onClick={confirmClose} disabled={closing || loadingDetails}>
              {closing ? "Menutup..." : "Konfirmasi Close Bill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
