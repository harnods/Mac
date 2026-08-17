/* eslint-disable @typescript-eslint/no-explicit-any */
import { getDeviceForWrite, getDeviceForWriteSilent, findWriteCharacteristic, writeBytes } from "@/lib/printer-bt";

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
async function ensureChar(deviceId: string, allowPrompt: boolean): Promise<any> {
  if (live && live.deviceId === deviceId && live.device?.gatt?.connected) return live.char;

  // Background prints (auto-print, keep-alive) must never trigger a chooser —
  // it needs a user gesture and would fail silently. Only manual actions prompt.
  const device = allowPrompt ? await getDeviceForWrite(deviceId) : await getDeviceForWriteSilent(deviceId);
  if (!device) throw new Error("Printer terputus — hubungkan ulang");
  const server = await device.gatt.connect();
  const char = await findWriteCharacteristic(server);
  registerLivePrinter(deviceId, device, char);
  return char;
}

/**
 * Send raw ESC/POS bytes to the paired thermal printer. Prefers the already-open
 * connection; falls back to the given deviceId or the first paired printer.
 * `allowPrompt` defaults true (manual actions); pass false for background prints.
 */
export async function printToPaired(
  bytes: Uint8Array,
  deviceId?: string,
  opts?: { allowPrompt?: boolean },
): Promise<void> {
  const printers = getPairedPrinters();
  const target = deviceId ?? live?.deviceId ?? printers[0]?.deviceId;
  if (!target) throw new Error("Belum ada printer yang di-pair");
  const char = await ensureChar(target, opts?.allowPrompt ?? true);
  await writeBytes(char, bytes);
}

/** Silently re-establish the connection (no chooser). Returns true on success. */
export async function reconnectPrinter(deviceId?: string): Promise<boolean> {
  const target = deviceId ?? live?.deviceId ?? getPairedPrinters()[0]?.deviceId;
  if (!target) return false;
  try {
    await ensureChar(target, false);
    return true;
  } catch {
    return false;
  }
}

/** Keep the BLE link warm so the OS/printer doesn't drop it while idle. Writes a
 *  harmless ESC @ (init) — no paper feed, no print. No-op if not connected. */
export async function keepAlivePrinter(): Promise<void> {
  if (!live || !live.device?.gatt?.connected) return;
  try {
    await writeBytes(live.char, new Uint8Array([0x1b, 0x40]));
  } catch {
    live = null;
  }
}
