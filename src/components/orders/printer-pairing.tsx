"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { Bluetooth, BluetoothConnected, Plus, Printer, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  DEVICE_INFO_SERVICE,
  OPTIONAL_SERVICES,
  getDeviceForWrite,
  findWriteCharacteristic,
  writeBytes,
} from "@/lib/printer-bt";
import { buildTestDocket } from "@/lib/escpos";
import { formatDateTime } from "@/lib/format";

// GATT Device Information characteristics we probe for a MAC.
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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const supported = typeof navigator !== "undefined" && "bluetooth" in navigator;

  // Live GATT connections kept open after pairing so printing needs no re-pair.
  const connectionsRef = useRef<Map<string, { device: any; char: any }>>(new Map());

  useEffect(() => {
    setPrinters(loadPrinters());
  }, []);

  function persist(list: PairedPrinter[]) {
    setPrinters(list);
    savePrinters(list);
  }

  function markConnected(deviceId: string, on: boolean) {
    setConnectedIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(deviceId);
      else next.delete(deviceId);
      return next;
    });
  }

  /** Hold a live connection and track disconnects. */
  function attach(deviceId: string, device: any, char: any) {
    connectionsRef.current.set(deviceId, { device, char });
    markConnected(deviceId, true);
    device.addEventListener("gattserverdisconnected", () => {
      connectionsRef.current.delete(deviceId);
      markConnected(deviceId, false);
    });
  }

  /** Return a live write characteristic for a printer, connecting if needed. */
  async function ensureConnected(deviceId: string): Promise<any> {
    const existing = connectionsRef.current.get(deviceId);
    if (existing && existing.device.gatt?.connected) return existing.char;

    const device = await getDeviceForWrite(deviceId);
    const server = await device.gatt.connect();
    const char = await findWriteCharacteristic(server);
    attach(device.id, device, char);
    return char;
  }

  async function pair() {
    setPairing(true);
    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: OPTIONAL_SERVICES,
      });

      const server = await device.gatt.connect();
      const mac = await readMac(server);
      const char = await findWriteCharacteristic(server);
      attach(device.id, device, char); // keep the connection open

      const entry: PairedPrinter = {
        deviceId: device.id,
        name: device.name ?? null,
        mac,
        addedAt: new Date().toISOString(),
      };
      persist([...printers.filter((p) => p.deviceId !== entry.deviceId), entry]);
      toast.success(`Printer paired${entry.name ? ` — ${entry.name}` : ""}`);
    } catch (err) {
      const msg = (err as Error).message;
      if (!/cancelled|User cancelled/i.test(msg)) toast.error(`Pairing failed: ${msg}`);
    } finally {
      setPairing(false);
    }
  }

  async function connect(p: PairedPrinter) {
    setBusyId(p.deviceId);
    try {
      await ensureConnected(p.deviceId);
      toast.success("Printer connected");
    } catch (err) {
      const msg = (err as Error).message;
      if (!/cancelled|User cancelled/i.test(msg)) toast.error(`Connection failed: ${msg}`);
    } finally {
      setBusyId(null);
    }
  }

  async function testPrint(p: PairedPrinter) {
    setBusyId(p.deviceId);
    try {
      const char = await ensureConnected(p.deviceId);
      const label = p.name ?? (p.mac ? `MAC ${p.mac}` : `Device ${p.deviceId.slice(0, 8)}`);
      await writeBytes(char, buildTestDocket(formatDateTime(new Date().toISOString()), label));
      toast.success("Test print sent");
    } catch (err) {
      const msg = (err as Error).message;
      if (!/cancelled|User cancelled/i.test(msg)) toast.error(`Test print failed: ${msg}`);
    } finally {
      setBusyId(null);
    }
  }

  function forget(deviceId: string) {
    const conn = connectionsRef.current.get(deviceId);
    try {
      conn?.device.gatt?.disconnect();
    } catch {
      /* ignore */
    }
    connectionsRef.current.delete(deviceId);
    markConnected(deviceId, false);
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
          {printers.map((p) => {
            const connected = connectedIds.has(p.deviceId);
            const busy = busyId === p.deviceId;
            return (
              <li key={p.deviceId} className="flex items-center gap-3 px-4 py-3">
                {connected ? (
                  <BluetoothConnected className="size-4 shrink-0 text-green-600" />
                ) : (
                  <Printer className="size-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{p.name ?? "Unknown printer"}</span>
                    <span className={`text-xs ${connected ? "text-green-600" : "text-muted-foreground"}`}>
                      {connected ? "Connected" : "Not connected"}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {p.mac ? `MAC ${p.mac}` : `Device ID ${p.deviceId}`}
                  </div>
                </div>
                {!connected && (
                  <Button variant="outline" size="sm" onClick={() => connect(p)} disabled={busy}>
                    <Bluetooth className="size-4" /> {busy ? "Connecting…" : "Connect"}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => testPrint(p)} disabled={busy}>
                  <Printer className="size-4" /> {busy ? "Printing…" : "Test print"}
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => forget(p.deviceId)}>
                  <Trash2 className="size-4" /> Forget
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <Button onClick={pair} disabled={pairing}>
        {pairing ? <Bluetooth className="size-4 animate-pulse" /> : <Plus className="size-4" />}
        {pairing ? "Pairing…" : "Pair printer"}
      </Button>
    </div>
  );
}
