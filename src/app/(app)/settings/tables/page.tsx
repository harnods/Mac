import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TableManager, type TableRow } from "@/components/settings/table-manager";

export const dynamic = "force-dynamic";

export default async function TablesSettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase
    .from("tables")
    .select("id, name, code")
    .order("name");

  const tables = (data ?? []) as unknown as TableRow[];

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Meja</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Kelola meja dan generate QR code untuk pemesanan mandiri.
        </p>
      </div>
      <TableManager initialTables={tables} />
    </div>
  );
}
