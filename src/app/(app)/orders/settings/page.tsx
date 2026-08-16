import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { PrintStationClient } from "../print-station/print-station-client";
import { PrinterPairing } from "@/components/orders/printer-pairing";

export const dynamic = "force-dynamic";

export default async function OrdersSettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Orders settings</h1>
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Printers</h2>
        <p className="text-sm text-muted-foreground">
          Pair a Bluetooth thermal printer. The device name and MAC address are shown when the
          printer exposes them; otherwise the Bluetooth device ID is used.
        </p>
        <PrinterPairing />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Print station</h2>
        <PrintStationClient />
      </div>
    </div>
  );
}
