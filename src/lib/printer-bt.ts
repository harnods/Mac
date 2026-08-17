// Shared Web Bluetooth helpers for cheap BLE thermal (ESC/POS) printers.
/* eslint-disable @typescript-eslint/no-explicit-any */

// Service UUIDs commonly exposed by cheap BLE thermal printers, plus the
// standard Device Information Service (used to read a MAC when available).
export const DEVICE_INFO_SERVICE = 0x180a;
export const PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
];

/** All services a paired printer may need exposed (write + info). */
export const OPTIONAL_SERVICES = [DEVICE_INFO_SERVICE, ...PRINTER_SERVICES];

export async function findWriteCharacteristic(server: any): Promise<any> {
  const services = await server.getPrimaryServices();
  for (const service of services) {
    const chars = await service.getCharacteristics();
    for (const ch of chars) {
      if (ch.properties.write || ch.properties.writeWithoutResponse) return ch;
    }
  }
  throw new Error("Could not find a writable printer characteristic");
}

export async function writeBytes(characteristic: any, bytes: Uint8Array) {
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

/**
 * Reconnect to a previously-paired device by id without a chooser when the
 * browser supports getDevices(); otherwise prompt the user to pick it again.
 */
export async function getDeviceForWrite(deviceId: string): Promise<any> {
  const silent = await getDeviceForWriteSilent(deviceId);
  if (silent) return silent;
  const bt = (navigator as any).bluetooth;
  return bt.requestDevice({ acceptAllDevices: true, optionalServices: OPTIONAL_SERVICES });
}

/**
 * Reconnect to a previously-granted device by id WITHOUT ever showing a chooser.
 * Returns null when the browser can't recall it (no getDevices, or not granted)
 * — used by background auto-print/keep-alive where a prompt would fail anyway.
 */
export async function getDeviceForWriteSilent(deviceId: string): Promise<any | null> {
  const bt = (navigator as any).bluetooth;
  if (!bt?.getDevices) return null;
  try {
    const devices: any[] = await bt.getDevices();
    return devices.find((d) => d.id === deviceId) ?? null;
  } catch {
    return null;
  }
}

/** Connect to a paired printer and send raw ESC/POS bytes. */
export async function sendToPrinter(deviceId: string, bytes: Uint8Array): Promise<void> {
  const device = await getDeviceForWrite(deviceId);
  const server = await device.gatt.connect();
  try {
    const ch = await findWriteCharacteristic(server);
    await writeBytes(ch, bytes);
  } finally {
    try {
      device.gatt.disconnect();
    } catch {
      /* ignore */
    }
  }
}
