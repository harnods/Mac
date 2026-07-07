"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bluetooth, BluetoothConnected, Printer, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatRp, formatDateTime } from "@/lib/format";
import { buildDocket, type DocketOrder } from "@/lib/escpos";
import { markOrderPrinted } from "@/app/actions/orders";

// Service UUIDs commonly exposed by cheap BLE thermal printers.
const PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
];

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  table_name_snapshot: string | null;
  total: number;
  notes: string | null;
  printed_at: string | null;
  created_at: string;
  order_items: { id: string; name_snapshot: string; qty: number }[];
};

/* eslint-disable @typescript-eslint/no-explicit-any */
async function findWriteCharacteristic(server: any): Promise<any> {
  const services = await server.getPrimaryServices();
  for (const service of services) {
    const chars = await service.getCharacteristics();
    for (const ch of chars) {
      if (ch.properties.write || ch.properties.writeWithoutResponse) return ch;
    }
  }
  throw new Error("Could not find a writable printer characteristic");
}

async function writeBytes(characteristic: any, bytes: Uint8Array) {
  const CHUNK = 180;
  const useNoResponse = characteristic.properties.writeWithoutResponse;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const chunk = bytes.slice(i, i + CHUNK);
    if (useNoResponse && characteristic.writeValueWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValue(chunk);
    }
    await new Promise((r) => setTimeout(r, 20));
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function PrintStationClient() {
  const supabase = useRef(createClient());
  const [supported] = useState(() =>
    typeof navigator === "undefined" ? true : !!("bluetooth" in navigator),
  );
  const [secure] = useState(() =>
    typeof window === "undefined" ? true : window.isSecureContext,
  );
  const [connected, setConnected] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [autoPrint, setAutoPrint] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const charRef = useRef<any>(null);
  const autoPrintRef = useRef(autoPrint);

  useEffect(() => {
    autoPrintRef.current = autoPrint;
  }, [autoPrint]);

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase.current
      .from("orders")
      .select(
        "id, order_number, status, customer_name, customer_phone, table_name_snapshot, total, notes, printed_at, created_at, order_items(id, name_snapshot, qty)",
      )
      .in("status", ["new", "preparing", "ready"])
      .order("created_at", { ascending: false })
      .limit(30);
    setOrders((data ?? []) as unknown as OrderRow[]);
  }, []);

  const printOrder = useCallback(async (order: OrderRow, silent = false) => {
    if (!charRef.current) {
      if (!silent) toast.error("Printer is not connected");
      return;
    }
    try {
      const docket: DocketOrder = {
        orderNumber: order.order_number,
        tableName: order.table_name_snapshot,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        createdAt: order.created_at,
        items: order.order_items.map((i) => ({ qty: i.qty, name: i.name_snapshot })),
        total: order.total,
        notes: order.notes,
      };
      await writeBytes(charRef.current, buildDocket(docket));
      await markOrderPrinted(order.id);
      toast.success(`Printed: ${order.order_number}`);
      fetchOrders();
    } catch (err) {
      toast.error(`Print failed: ${(err as Error).message}`);
    }
  }, [fetchOrders]);

  // Initial load + realtime subscription.
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
            if (!autoPrintRef.current || !charRef.current) return;
            const { data } = await supabase.current
              .from("orders")
              .select(
                "id, order_number, status, customer_name, customer_phone, table_name_snapshot, total, notes, printed_at, created_at, order_items(id, name_snapshot, qty)",
              )
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

  async function connect() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: PRINTER_SERVICES,
      });
      device.addEventListener("gattserverdisconnected", () => {
        setConnected(false);
        charRef.current = null;
      });
      const server = await device.gatt.connect();
      charRef.current = await findWriteCharacteristic(server);
      setDeviceName(device.name ?? "Printer");
      setConnected(true);
      toast.success("Printer connected");
    } catch (err) {
      const msg = (err as Error).message;
      if (!/cancelled|User cancelled/i.test(msg)) toast.error(`Connection failed: ${msg}`);
    }
  }

  if (!secure) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground flex gap-3">
        <AlertTriangle className="size-5 shrink-0 text-amber-500" />
        <div>
          Web Bluetooth only works on secure connections (HTTPS). Open this page from the
          production URL (Vercel, HTTPS) on an Android tablet, not from a local IP address.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {connected ? (
              <BluetoothConnected className="size-5 text-green-600" />
            ) : (
              <Bluetooth className="size-5 text-muted-foreground" />
            )}
            <span className="text-sm">
              {connected ? `Connected — ${deviceName}` : "Printer is not connected"}
            </span>
          </div>
          <Button onClick={connect} variant={connected ? "outline" : "default"} disabled={!supported}>
            {connected ? "Reconnect" : "Connect printer"}
          </Button>
        </div>
        {!supported && (
          <p className="text-xs text-muted-foreground">
            This browser does not support Web Bluetooth. Use Chrome on Android.
          </p>
        )}
        <div className="flex items-center gap-2">
          <Switch id="auto" checked={autoPrint} onCheckedChange={setAutoPrint} />
          <Label htmlFor="auto" className="text-sm cursor-pointer">
            Automatically print new orders
          </Label>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Active orders</h2>
        {orders.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
            No orders yet.
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold tabular-nums">{o.order_number}</span>
                    {o.printed_at && (
                      <Badge variant="secondary" className="text-xs">
                        Printed
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {o.order_items.length} item · {formatRp(o.total)} · {formatDateTime(o.created_at)}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => printOrder(o)} disabled={!connected}>
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
