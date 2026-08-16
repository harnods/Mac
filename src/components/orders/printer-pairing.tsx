"use client";

import { useEffect, useState } from "react";
import { Bluetooth, Plus, Printer, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Standard GATT Device Information Service + characteristics we probe for a MAC.
const DEVICE_INFO_SERVICE = 0x180a;
const SYSTEM_ID = 0x2a23; // 8-byte EUI-64, often derived from the 48-bit MAC
const SERIAL_NUMBER = 0x2a25; // some printers put their MAC here as a string

const STORAGE_KEY = "machitori.printers";

type PairedPrinter = {
  deviceId: string;
  name: string | null;
  mac: string | null; // best-effort MAC; null when unavailable
  addedAt: string;
};

function loadPrinters(): PairedPrinter[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PairedPrinter[]) : [];
  } catch {
    return [];
  }
}

function savePrinters(list: PairedPrinter[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

const hex = (n: number) => n.toString(16).padStart(2, "0");

/** Best-effort MAC read from the Device Information Service. Returns null if the
 * printer doesn't expose it — the caller then falls back to the Bluetooth ID. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readMac(server: any): Promise<string | null> {
  try {
    const dis = await server.getPrimaryService(DEVICE_INFO_SERVICE);

    // System ID (0x2A23): 8 bytes. When derived from a 48-bit MAC the middle
    // two bytes are 0xFF 0xFE (EUI-48 -> EUI-64); strip them to rebuild the MAC.
    try {
      const c = await dis.getCharacteristic(SYSTEM_ID);
      const v = await c.readValue();
      if (v.byteLength === 8) {
        const b = new Uint8Array(v.buffer);
        if (b[3] === 0xff && b[4] === 0xfe) {
          return [b[7], b[6], b[5], b[2], b[1], b[0]].map(hex).join(":").toUpperCase();
        }
      }
    } catch {
      /* characteristic not present */
    }

    // Serial number string (0x2A25) — accept it if it looks like a MAC.
    try {
      const c = await dis.getCharacteristic(SERIAL_NUMBER);
      const v = await c.readValue();
      const s = new TextDecoder().decode(v).trim();
      if (/^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(s)) return s.toUpperCase();
    } catch {
      /* characteristic not present */
    }
  } catch {
    /* device information service not present */
  }
  return null;
}

export function PrinterPairing() {
  const [printers, setPrinters] = useState<PairedPrinter[]>([]);
  const [pairing, setPairing] = useState(false);
  const supported = typeof navigator !== "undefined" && "bluetooth" in navigator;

  useEffect(() => {
    setPrinters(loadPrinters());
  }, []);

  function persist(list: PairedPrinter[]) {
    setPrinters(list);
    savePrinters(list);
  }

  async function pair() {
    setPairing(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [DEVICE_INFO_SERVICE],
      });

      let mac: string | null = null;
      try {
        const server = await device.gatt.connect();
        mac = await readMac(server);
        device.gatt.disconnect();
      } catch {
        /* couldn't read info — keep mac null, fall back to the id */
      }

      const entry: PairedPrinter = {
        deviceId: device.id,
        name: device.name ?? null,
        mac,
        addedAt: new Date().toISOString(),
      };

      const existing = printers.filter((p) => p.deviceId !== entry.deviceId);
      persist([...existing, entry]);
      toast.success(`Printer paired${entry.name ? ` — ${entry.name}` : ""}`);
    } catch (err) {
      const msg = (err as Error).message;
      if (!/cancelled|User cancelled/i.test(msg)) toast.error(`Pairing failed: ${msg}`);
    } finally {
      setPairing(false);
    }
  }

  function forget(deviceId: string) {
    persist(printers.filter((p) => p.deviceId !== deviceId));
  }

  if (!supported) {
    return (
      <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
        <AlertTriangle className="size-4 shrink-0 mt-0.5" />
        <span>
          This browser doesn&apos;t support Web Bluetooth. Use Chrome on Android over HTTPS to pair a printer.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {printers.length === 0 ? (
        <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
          No printers paired yet.
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {printers.map((p) => (
            <li key={p.deviceId} className="flex items-center gap-3 px-4 py-3">
              <Printer className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{p.name ?? "Unknown printer"}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  {p.mac ? `MAC ${p.mac}` : `Device ID ${p.deviceId}`}
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => forget(p.deviceId)}>
                <Trash2 className="size-4" /> Forget
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Button onClick={pair} disabled={pairing}>
        {pairing ? <Bluetooth className="size-4 animate-pulse" /> : <Plus className="size-4" />}
        {pairing ? "Pairing…" : "Pair printer"}
      </Button>
    </div>
  );
}
