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
import { buildTableChecker, buildTestDocket, type TableChecker } from "@/lib/escpos";
import { getPairedPrinters, printToPaired } from "@/lib/printer";
import { markOrderPrinted } from "@/app/actions/orders";

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
  order_items: { id: string; name_snapshot: string; qty: number }[];
};

const ORDER_SELECT =
  "id, seq, order_number, status, table_name_snapshot, total, notes, printed_at, created_at, order_items(id, name_snapshot, qty)";

const LOCATION_KEY = "machitori.print_location";
const AUTOPRINT_KEY = "machitori.print_autoprint";

/** Running order number for the day (Jakarta): how many orders share today up
 *  to and including this one. */
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
  const [autoPrint, setAutoPrint] = useState(true);
  const [busy, setBusy] = useState(false);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  const autoPrintRef = useRef(autoPrint);
  const locationRef = useRef(location);
  useEffect(() => { autoPrintRef.current = autoPrint; }, [autoPrint]);
  useEffect(() => { locationRef.current = location; }, [location]);

  // Client-only settings, read after mount to keep SSR/CSR markup identical.
  useEffect(() => {
    setMounted(true);
    setPrinterName(getPairedPrinters()[0]?.name ?? null);
    try {
      const savedLoc = localStorage.getItem(LOCATION_KEY);
      if (savedLoc) setLocation(savedLoc);
      const savedAuto = localStorage.getItem(AUTOPRINT_KEY);
      if (savedAuto != null) setAutoPrint(savedAuto === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function changeLocation(v: string) {
    setLocation(v);
    try { localStorage.setItem(LOCATION_KEY, v); } catch { /* ignore */ }
  }
  function changeAutoPrint(v: boolean) {
    setAutoPrint(v);
    try { localStorage.setItem(AUTOPRINT_KEY, v ? "1" : "0"); } catch { /* ignore */ }
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

  const printOrder = useCallback(async (order: OrderRow, silent = false) => {
    try {
      // Daily queue number.
      const { count } = await supabase.current
        .from("orders")
        .select("id", { count: "exact", head: true })
        .gte("created_at", jakartaDayStartIso())
        .lte("seq", order.seq);

      const checker: TableChecker = {
        orderNumber: order.order_number,
        tableName: order.table_name_snapshot,
        createdAt: order.created_at,
        orderType: "DINE IN",
        items: order.order_items.map((i) => ({ qty: i.qty, name: i.name_snapshot })),
        queue: count ?? null,
        location: locationRef.current,
      };
      await printToPaired(buildTableChecker(checker));
      await markOrderPrinted(order.id);
      if (!silent) toast.success(`Tercetak: ${order.order_number}`);
      fetchOrders();
    } catch (err) {
      const msg = (err as Error).message;
      if (!silent) toast.error(`Gagal print: ${msg}`);
    }
  }, [fetchOrders]);

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
            if (!autoPrintRef.current) return;
            const { data } = await supabase.current
              .from("orders")
              .select(ORDER_SELECT)
              .eq("id", row.id)
              .maybeSingle();
            if (data) printOrder(data as unknown as OrderRow, true);
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

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Lokasi printer</Label>
            <Select value={location} onValueChange={changeLocation}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Bar">Bar</SelectItem>
                <SelectItem value="Kitchen">Kitchen</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <div className="flex items-center gap-2">
              <Switch id="auto" checked={autoPrint} onCheckedChange={changeAutoPrint} />
              <Label htmlFor="auto" className="text-sm cursor-pointer">
                Auto-print pesanan masuk
              </Label>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Biarkan halaman ini tetap terbuka di tablet {location.toLowerCase()}. Setiap pesanan baru
          (dari QR customer maupun manual) otomatis dicetak sebagai Table Checker.
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
                <Button size="sm" variant="outline" onClick={() => printOrder(o)} disabled={busy}>
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
