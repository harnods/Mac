"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Printer } from "lucide-react";
import { toast } from "sonner";
import { settleOrderItems, settleTableBill } from "@/app/actions/orders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { formatRp } from "@/lib/format";
import { calculateOrderCharges, formatRate, PBJT_RATE, SERVICE_CHARGE_RATE } from "@/lib/order-charges";
import { NewOrderModal } from "./new-order-modal";

const OPEN_STATUSES = ["new", "preparing", "ready"];

export type PosTable = {
  id: string;
  name: string;
  code: string;
};

export type PosBillOrder = {
  id: string;
  order_number: string;
  table_id: string;
  table_name_snapshot: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: "new" | "preparing" | "ready" | "completed";
  total: number;
  created_at: string;
  updated_at: string;
  order_items: OrderLine[];
};

type OrderLine = {
  id: string;
  name_snapshot: string;
  qty: number;
  unit_price: number;
  line_total: number;
  closed_at: string | null;
};

type PosBill = {
  id: string;
  tableId: string;
  tableName: string;
  orderCount: number;
  subtotal: number;
  total: number;
  statuses: string[];
  orderIds: string[];
  itemIds: string[];
  orderNumbers: string[];
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
};

type OrderDetail = {
  id: string;
  order_number: string;
  subtotal: number;
  service_charge: number;
  tax_total: number;
  total: number;
  order_items: OrderLine[];
};

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatDuration(fromIso: string, toIso: string) {
  const minutes = Math.max(0, Math.floor((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000));
  if (minutes < 1) return "less than 1 min";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return remainingMinutes > 0 ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days} day ${remainingHours} hr` : `${days} day`;
}

function getTableName(order: PosBillOrder) {
  return order.table_name_snapshot ?? order.customer_name ?? order.customer_phone ?? "Untitled table";
}

function groupOpenBills(orders: PosBillOrder[]) {
  const map = new Map<string, PosBill>();
  for (const order of orders.filter((item) => OPEN_STATUSES.includes(item.status))) {
    const openItems = order.order_items.filter((item) => !item.closed_at);
    if (openItems.length === 0) continue;
    const subtotal = openItems.reduce((sum, item) => sum + Number(item.line_total), 0);
    const existing = map.get(order.table_id);
    if (existing) {
      existing.orderCount++;
      existing.subtotal += subtotal;
      existing.orderIds.push(order.id);
      existing.itemIds.push(...openItems.map((item) => item.id));
      existing.orderNumbers.push(order.order_number);
      if (!existing.statuses.includes(order.status)) existing.statuses.push(order.status);
      if (order.created_at < existing.createdAt) existing.createdAt = order.created_at;
      if (order.updated_at > existing.updatedAt) existing.updatedAt = order.updated_at;
    } else {
      map.set(order.table_id, {
        id: order.table_id,
        tableId: order.table_id,
        tableName: getTableName(order),
        orderCount: 1,
        subtotal,
        total: 0,
        statuses: [order.status],
        orderIds: [order.id],
        itemIds: openItems.map((item) => item.id),
        orderNumbers: [order.order_number],
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        closedAt: null,
      });
    }
  }
  return [...map.values()]
    .map((bill) => ({ ...bill, total: calculateOrderCharges(bill.subtotal).total }))
    .sort((a, b) => a.tableName.localeCompare(b.tableName));
}

function groupClosedBills(orders: PosBillOrder[]) {
  const map = new Map<string, PosBill>();
  for (const order of orders) {
    for (const item of order.order_items.filter((line) => line.closed_at)) {
      const closedAt = item.closed_at!;
      const closedBucket = closedAt.slice(0, 16);
      const key = `${order.table_id}:${closedBucket}`;
      const subtotal = Number(item.line_total);
      const existing = map.get(key);
      if (existing) {
        if (!existing.orderIds.includes(order.id)) {
          existing.orderCount++;
          existing.orderIds.push(order.id);
          existing.orderNumbers.push(order.order_number);
        }
        existing.subtotal += subtotal;
        existing.itemIds.push(item.id);
        if (order.created_at < existing.createdAt) existing.createdAt = order.created_at;
        if (closedAt > existing.updatedAt) existing.updatedAt = closedAt;
        if (!existing.closedAt || closedAt > existing.closedAt) existing.closedAt = closedAt;
      } else {
        map.set(key, {
          id: key,
          tableId: order.table_id,
          tableName: getTableName(order),
          orderCount: 1,
          subtotal,
          total: 0,
          statuses: ["completed"],
          orderIds: [order.id],
          itemIds: [item.id],
          orderNumbers: [order.order_number],
          createdAt: order.created_at,
          updatedAt: closedAt,
          closedAt,
        });
      }
    }
  }
  return [...map.values()]
    .map((bill) => ({ ...bill, total: calculateOrderCharges(bill.subtotal).total }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 30);
}

function BillCard({
  bill,
  closed = false,
  onView,
  paymentMethods,
}: {
  bill: PosBill;
  closed?: boolean;
  onView: (bill: PosBill) => void;
  paymentMethods: string[];
}) {
  const [settling, startSettle] = useTransition();
  const [settleOpen, setSettleOpen] = useState(false);
  const [method, setMethod] = useState(paymentMethods[0] ?? "");
  const router = useRouter();

  function settle() {
    if (!method) {
      toast.error("Pilih metode pembayaran");
      return;
    }
    startSettle(async () => {
      const res = await settleTableBill(bill.tableId, method);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Bill ${bill.tableName} lunas — tercatat di Sales`);
      setSettleOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-bold leading-none">{bill.tableName}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {bill.orderCount} order{bill.orderCount === 1 ? "" : "s"} · {bill.orderNumbers.join(", ")}
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3" /> {formatTime(bill.updatedAt)}
        </div>
      </div>

      <div className="flex items-center justify-between border-t pt-2">
        <span className="text-sm font-bold tabular-nums">{formatRp(bill.total)}</span>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onView(bill)}>
            View details
          </Button>
          {!closed && (
            <Button size="sm" className="h-8 text-xs" onClick={() => setSettleOpen(true)}>
              Settle &amp; pay
            </Button>
          )}
        </div>
      </div>

      <Dialog open={settleOpen} onOpenChange={setSettleOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Settle {bill.tableName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-lg font-bold tabular-nums">{formatRp(bill.total)}</span>
            </div>
            {paymentMethods.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada metode pembayaran. Tambahkan di Settings → Payment methods.
              </p>
            ) : (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Metode pembayaran</label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger><SelectValue placeholder="Pilih metode" /></SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSettleOpen(false)}>Batal</Button>
            <Button onClick={settle} disabled={settling || paymentMethods.length === 0 || !method}>
              {settling ? "Memproses..." : "Settle & pay"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PosBillsBoard({
  initialOrders,
  tables = [],
  paymentMethods = [],
}: {
  initialOrders: PosBillOrder[];
  tables?: PosTable[];
  paymentMethods?: string[];
}) {
  const router = useRouter();
  const supabase = useRef(createClient());
  const [selectedBill, setSelectedBill] = useState<PosBill | null>(null);
  const [orderDetails, setOrderDetails] = useState<OrderDetail[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [closingSelected, startCloseSelected] = useTransition();
  const [splitMethod, setSplitMethod] = useState(paymentMethods[0] ?? "");
  const openBills = useMemo(() => groupOpenBills(initialOrders), [initialOrders]);
  const closedBills = useMemo(() => groupClosedBills(initialOrders), [initialOrders]);
  const occupiedTableIds = useMemo(() => new Set(openBills.map((bill) => bill.tableId)), [openBills]);

  useEffect(() => {
    const client = supabase.current;
    const channel = client
      .channel("pos-bills-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        router.refresh();
      })
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [router]);

  async function openBillDetails(bill: PosBill) {
    setSelectedBill(bill);
    setLoadingDetails(true);
    const { data } = await supabase.current
      .from("orders")
      .select("id, order_number, subtotal, service_charge, tax_total, total, order_items(id, name_snapshot, qty, unit_price, line_total, closed_at)")
      .in("id", bill.orderIds)
      .order("created_at", { ascending: true });

    setOrderDetails((data ?? []) as unknown as OrderDetail[]);
    setSelectedItemIds(new Set(bill.itemIds));
    setLoadingDetails(false);
  }

  const detailItems = orderDetails.flatMap((order) =>
    order.order_items
      .filter((item) => selectedBill?.itemIds.includes(item.id))
      .map((item) => ({ ...item, orderNumber: order.order_number })),
  );
  const selectedSubtotal = detailItems
    .filter((item) => selectedItemIds.has(item.id))
    .reduce((sum, item) => sum + Number(item.line_total), 0);
  const detailSubtotal = selectedBill?.closedAt ? selectedBill.subtotal : selectedSubtotal;
  const detailCharges = calculateOrderCharges(detailSubtotal);
  const detailServiceCharge = detailCharges.serviceCharge;
  const detailTaxTotal = detailCharges.taxTotal;
  const detailTotal = detailCharges.total;
  const agingEnd = selectedBill?.closedAt ?? new Date().toISOString();
  const printBill = () => window.print();
  const canSplit = !!selectedBill && !selectedBill.closedAt;

  function toggleItem(itemId: string) {
    setSelectedItemIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function settleSelectedItems() {
    if (!splitMethod) {
      toast.error("Pilih metode pembayaran");
      return;
    }
    const ids = [...selectedItemIds];
    startCloseSelected(async () => {
      const res = await settleOrderItems(ids, splitMethod);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Item terpilih lunas — tercatat di Sales");
      setSelectedBill(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">POS</h1>
        <NewOrderModal tables={tables} occupiedTableIds={occupiedTableIds} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Open bills</h2>
            <Badge variant="secondary" className="tabular-nums">
              {openBills.length}
            </Badge>
          </div>
          <div className="space-y-3">
            {openBills.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                No open bills.
              </div>
            ) : (
              openBills.map((bill) => (
                <BillCard key={bill.id} bill={bill} onView={openBillDetails} paymentMethods={paymentMethods} />
              ))
            )}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Closed bills</h2>
            <Badge variant="secondary" className="tabular-nums">
              {closedBills.length}
            </Badge>
          </div>
          <div className="space-y-3">
            {closedBills.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                No closed bills.
              </div>
            ) : (
              closedBills.map((bill) => (
                <BillCard key={bill.id} bill={bill} closed onView={openBillDetails} paymentMethods={paymentMethods} />
              ))
            )}
          </div>
        </section>
      </div>

      <Dialog open={!!selectedBill} onOpenChange={(open) => { if (!open) setSelectedBill(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedBill?.tableName}</DialogTitle>
          </DialogHeader>

          {loadingDetails ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : (
            <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
              {selectedBill && (
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted px-3 py-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Created</div>
                    <div className="mt-1 font-medium tabular-nums">{formatDateTime(selectedBill.createdAt)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Closed</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 font-medium tabular-nums">
                      <span>{selectedBill.closedAt ? formatDateTime(selectedBill.closedAt) : "Not closed yet"}</span>
                      <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium">
                        {formatDuration(selectedBill.createdAt, agingEnd)}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              {orderDetails.map((order, orderIndex) => {
                const visibleItems = order.order_items.filter((item) => selectedBill?.itemIds.includes(item.id));
                if (visibleItems.length === 0) return null;
                return (
                <div key={order.id} className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Order #{orderIndex + 1} · {order.order_number}
                  </div>
                  {visibleItems.map((item) => (
                    <label key={item.id} className="flex items-center justify-between gap-2 text-sm">
                      {canSplit && (
                        <input
                          type="checkbox"
                          checked={selectedItemIds.has(item.id)}
                          onChange={() => toggleItem(item.id)}
                          className="size-4"
                        />
                      )}
                      <span className="tabular-nums text-muted-foreground">{item.qty}x</span>
                      <span className="flex-1">{item.name_snapshot}</span>
                      <span className="tabular-nums">{formatRp(item.line_total)}</span>
                    </label>
                  ))}
                </div>
                );
              })}

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{formatRp(detailSubtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service charge ({formatRate(SERVICE_CHARGE_RATE)})</span>
                  <span className="tabular-nums">{formatRp(detailServiceCharge)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PBJT ({formatRate(PBJT_RATE)})</span>
                  <span className="tabular-nums">{formatRp(detailTaxTotal)}</span>
                </div>
              </div>

              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span className="tabular-nums">{formatRp(detailTotal)}</span>
              </div>
            </div>
          )}

          <DialogFooter className="sm:flex-col sm:items-stretch sm:space-x-0 sm:gap-2">
            {canSplit && paymentMethods.length > 0 && (
              <Select value={splitMethod} onValueChange={setSplitMethod}>
                <SelectTrigger><SelectValue placeholder="Metode pembayaran" /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={printBill} disabled={canSplit && selectedItemIds.size === 0}>
                <Printer className="size-4" /> {canSplit ? "Print selected" : "Print"}
              </Button>
              {canSplit && (
                <Button
                  className="flex-1"
                  onClick={settleSelectedItems}
                  disabled={selectedItemIds.size === 0 || closingSelected || paymentMethods.length === 0 || !splitMethod}
                >
                  {closingSelected ? "Memproses..." : "Settle selected"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
