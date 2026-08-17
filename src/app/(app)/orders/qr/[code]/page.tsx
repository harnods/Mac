import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QrPrintCard } from "./qr-print-card";

export const dynamic = "force-dynamic";

export default async function TableQrPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();

  const { data: table } = await supabase
    .from("tables")
    .select("id, name, code")
    .eq("code", code)
    .maybeSingle();

  if (!table) notFound();

  return <QrPrintCard name={table.name as string} code={table.code as string} />;
}
