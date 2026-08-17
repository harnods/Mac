"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Printer, AlertTriangle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatRp, formatDateTime } from "@/lib/format";
import { buildStationDocket, buildTableChecker, buildTestDocket, type TableChecker } from "@/lib/escpos";
import { getPairedPrinters, printToPaired } from "@/lib/printer";
import { markOrderPrinted } from "@/app/actions/orders";

type OrderItem = { id: string; name_snapshot: string; qty: number; item_id: string | null; item: { station: string | null } | null };
type OrderRow = {
  id: string;
  seq: number;
  order_number: string;
  status: string;
  table_name_snapshot: string | null;
  total: number;
  notes: string | null;
  printed_at: string | null;
  created_at: string;
  order_items: OrderItem[];
};

const ORDER_SELECT =
  "id, seq, order_number, status, table_name_snapshot, total, notes, printed_at, created_at, order_items(id, name_snapshot, qty, item_id, item:items!item_id(station))";

const LOCATION_KEY = "machitori.print_location";
const DOCKET_KEY = "machitori.print_auto_docket";
const CHECKER_KEY = "machitori.print_auto_checker";

/** Unassigned products default to the bar. */
function itemStation(it: OrderItem): "bar" | "kitchen" {
  return it.item?.station === "kitchen" ? "kitchen" : "bar";
}

function jakartaDayStartIso(): string {
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  return new Date(`${day}T00:00:00+07:00`).toISOString();
}

export function PrintStationClient() {
  const supabase = useRef(createClient());
  const [mounted, setMounted] = useState(false);
  const [secure] = useState(() => (typeof window === "undefined" ? true : window.isSecureContext));
  const [printerName, setPrinterName] = useState<string | null>(null);
  const [location, setLocation] = useState("Bar");
  const [autoDocket, setAutoDocket] = useState(true);
  const [autoChecker, setAutoChecker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  const locationRef = useRef(location);
  const docketRef = useRef(autoDocket);
  const checkerRef = useRef(autoChecker);
  useEffect(() => { locationRef.current = location; }, [location]);
  useEffect(() => { docketRef.current = autoDocket; }, [autoDocket]);
  useEffect(() => { checkerRef.current = autoChecker; }, [autoChecker]);

  useEffect(() => {
    setMounted(true);
    setPrinterName(getPairedPrinters()[0]?.name ?? null);
    try {
      const loc = localStorage.getItem(LOCATION_KEY);
      if (loc) setLocation(loc);
      const d = localStorage.getItem(DOCKET_KEY);
      if (d != null) setAutoDocket(d === "1");
      const c = localStorage.getItem(CHECKER_KEY);
      if (c != null) setAutoChecker(c === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function changeLocation(v: string) {
    setLocation(v);
    try { localStorage.setItem(LOCATION_KEY, v); } catch { /* ignore */ }
  }
  function persistToggle(key: string, v: boolean) {
    try { localStorage.setItem(key, v ? "1" : "0"); } catch { /* ignore */ }
  }

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase.current
      .from("orders")
      .select(ORDER_SELECT)
      .in("status", ["new", "preparing", "ready"])
      .order("created_at", { ascending: false })
      .limit(30);
    setOrders((data ?? []) as unknown as OrderRow[]);
  }, []);

  const dailyQueue = useCallback(async (seq: number): Promise<number | null> => {
    const { count } = await supabase.current
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", jakartaDayStartIso())
      .lte("seq", seq);
    return count ?? null;
  }, []);

  /** Print whatever this station is responsible for: its station docket and/or
   *  the full table checker, per the toggles. */
  const printOrder = useCallback(
    async (order: OrderRow, opts: { docket: boolean; checker: boolean; silent?: boolean }) => {
      const loc = locationRef.current.toLowerCase() as "bar" | "kitchen";
      const stationItems = order.order_items.filter((i) => itemStation(i) === loc);

      if (opts.docket && stationItems.length === 0 && !opts.checker) {
        if (!opts.silent) toast.info(`Tidak ada item ${locationRef.current} di ${order.order_number}`);
        return;
      }

      try {
        const queue = await dailyQueue(order.seq);
        const base: TableChecker = {
          orderNumber: order.order_number,
          tableName: order.table_name_snapshot,
          createdAt: order.created_at,
          orderType: "DINE IN",
          items: [],
          queue,
          location: locationRef.current,
        };

        if (opts.docket && stationItems.length > 0) {
          await printToPaired(
            buildStationDocket({
              ...base,
              station: locationRef.current,
              items: stationItems.map((i) => ({ qty: i.qty, name: i.name_snapshot })),
            }),
          );
        }
        if (opts.checker) {
          await printToPaired(
            buildTableChecker({
              ...base,
              items: order.order_items.map((i) => ({ qty: i.qty, name: i.name_snapshot })),
            }),
          );
        }

        await markOrderPrinted(order.id);
        if (!opts.silent) toast.success(`Tercetak: ${order.order_number}`);
        fetchOrders();
      } catch (err) {
        const msg = (err as Error).message;
        if (!opts.silent) toast.error(`Gagal print: ${msg}`);
      }
    },
    [dailyQueue, fetchOrders],
  );

  // Initial load + realtime auto-print on new orders.
  useEffect(() => {
    const client = supabase.current;
    fetchOrders();
    const known = new Set<string>();
    const channel = client
      .channel("print-station")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        async (payload) => {
          fetchOrders();
          const row = payload.new as { id?: string } | null;
          if (payload.eventType === "INSERT" && row?.id && !known.has(row.id)) {
            known.add(row.id);
            if (!docketRef.current && !checkerRef.current) return;
            const { data } = await supabase.current.from("orders").select(ORDER_SELECT).eq("id", row.id).maybeSingle();
            if (data) printOrder(data as unknown as OrderRow, { docket: docketRef.current, checker: checkerRef.current, silent: true });
          }
        },
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [fetchOrders, printOrder]);

  async function testPrint() {
    setBusy(true);
    try {
      await printToPaired(buildTestDocket(formatDateTime(new Date().toISOString()), `Location: ${location}`));
      toast.success("Test print terkirim — printer siap");
    } catch (err) {
      const msg = (err as Error).message;
      if (!/cancelled|User cancelled/i.test(msg)) toast.error(`Gagal: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  if (!secure) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground flex gap-3">
        <AlertTriangle className="size-5 shrink-0 text-amber-500" />
        <div>
          Web Bluetooth hanya jalan di koneksi aman (HTTPS). Buka halaman ini dari URL produksi
          (HTTPS) di tablet Android — bukan dari IP lokal.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border p-4 space-y-4">
        {mounted && !printerName ? (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-500" />
            <span>Belum ada printer yang di-pair. Pair dulu di bagian Printers di atas.</span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-green-600" />
              <span className="text-sm">Printer: {printerName ?? "…"}</span>
            </div>
            <Button variant="outline" onClick={testPrint} disabled={busy}>
              <Printer className="size-4" /> {busy ? "…" : "Test print"}
            </Button>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Lokasi printer</Label>
          <Select value={location} onValueChange={changeLocation}>
            <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Bar">Bar</SelectItem>
              <SelectItem value="Kitchen">Kitchen</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 rounded-lg bg-muted/40 p-3">
          <div className="flex items-center gap-2">
            <Switch id="docket" checked={autoDocket} onCheckedChange={(v) => { setAutoDocket(v); persistToggle(DOCKET_KEY, v); }} />
            <Label htmlFor="docket" className="text-sm cursor-pointer">
              Auto-print docket <span className="text-muted-foreground">(hanya item {location})</span>
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="checker" checked={autoChecker} onCheckedChange={(v) => { setAutoChecker(v); persistToggle(CHECKER_KEY, v); }} />
            <Label htmlFor="checker" className="text-sm cursor-pointer">
              Auto-print table checker <span className="text-muted-foreground">(seluruh order — nyalakan di 1 station saja)</span>
            </Label>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Biarkan halaman ini terbuka di tablet {location.toLowerCase()}. Setiap pesanan baru (QR
          customer maupun manual) otomatis dicetak. Produk tanpa station dianggap Bar.
        </p>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Pesanan aktif</h2>
        {orders.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
            Belum ada pesanan.
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold tabular-nums">{o.order_number}</span>
                    {o.table_name_snapshot && (
                      <span className="text-xs text-muted-foreground">{o.table_name_snapshot}</span>
                    )}
                    {o.printed_at && <Badge variant="secondary" className="text-xs">Tercetak</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {o.order_items.length} item · {formatRp(o.total)} · {formatDateTime(o.created_at)}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => printOrder(o, { docket: true, checker: autoChecker })} disabled={busy}>
                  <Printer className="size-4" /> Print
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
