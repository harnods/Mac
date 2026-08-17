/* eslint-disable @typescript-eslint/no-explicit-any */
import { getDeviceForWrite, findWriteCharacteristic, writeBytes } from "@/lib/printer-bt";

/** A printer paired via Settings → Orders (stored by PrinterPairing). */
export type PairedPrinter = {
  deviceId: string;
  name: string | null;
  mac: string | null;
  addedAt: string;
};

const STORAGE_KEY = "machitori.printers";

/** Printers the user has paired on this device (client-only). */
export function getPairedPrinters(): PairedPrinter[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PairedPrinter[]) : [];
  } catch {
    return [];
  }
}

// A single live BLE connection shared across the whole app. Module-level state
// survives client-side navigation (Settings → POS), so once the printer is
// connected — during pairing or a first print — every later print reuses the
// same open connection and never re-prompts.
type LiveConn = { deviceId: string; device: any; char: any };
let live: LiveConn | null = null;

/**
 * Register an already-connected printer so it can be reused app-wide. Called by
 * the pairing screen right after it connects, so printing elsewhere needs no
 * reconnect and no chooser prompt.
 */
export function registerLivePrinter(deviceId: string, device: any, char: any) {
  live = { deviceId, device, char };
  try {
    device.addEventListener?.("gattserverdisconnected", () => {
      if (live?.deviceId === deviceId) live = null;
    });
  } catch {
    /* ignore */
  }
}

/** True when a printer connection is currently open. */
export function hasLivePrinter(): boolean {
  return !!(live && live.device?.gatt?.connected);
}

/** Reuse the open connection if we have one; otherwise reconnect silently
 *  (via getDevices) — only prompting if the browser can't recall the device. */
async function ensureChar(deviceId: string): Promise<any> {
  if (live && live.deviceId === deviceId && live.device?.gatt?.connected) return live.char;

  const device = await getDeviceForWrite(deviceId);
  const server = await device.gatt.connect();
  const char = await findWriteCharacteristic(server);
  registerLivePrinter(deviceId, device, char);
  return char;
}

/**
 * Send raw ESC/POS bytes to the paired thermal printer. Prefers the already-open
 * connection; falls back to the given deviceId or the first paired printer.
 * Throws with a friendly message when no printer is paired.
 */
export async function printToPaired(bytes: Uint8Array, deviceId?: string): Promise<void> {
  const printers = getPairedPrinters();
  const target = deviceId ?? live?.deviceId ?? printers[0]?.deviceId;
  if (!target) throw new Error("Belum ada printer yang di-pair");
  const char = await ensureChar(target);
  await writeBytes(char, bytes);
}
