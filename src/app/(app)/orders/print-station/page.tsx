import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { PrintStationClient } from "./print-station-client";

export const dynamic = "force-dynamic";

export default async function PrintStationPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight">Print station</h1>
      <PrintStationClient />
    </div>
  );
}
