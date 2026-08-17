import { sendToPrinter } from "@/lib/printer-bt";

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

/**
 * Send raw ESC/POS bytes to the paired thermal printer. Uses the given
 * deviceId, or the first paired printer if none is specified. Throws with a
 * friendly message when no printer is paired.
 */
export async function printToPaired(bytes: Uint8Array, deviceId?: string): Promise<void> {
  const printers = getPairedPrinters();
  const target = deviceId ?? printers[0]?.deviceId;
  if (!target) throw new Error("Belum ada printer yang di-pair");
  await sendToPrinter(target, bytes);
}
