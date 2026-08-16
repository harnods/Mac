import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { SalesEditForm } from "@/components/sales/sales-edit-form";

export const dynamic = "force-dynamic";

export default async function EditSalesEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!can(profile, P.SALES_WRITE)) redirect(`/sales/${id}`);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_entries")
    .select("id, entry_date, shift, notes, total_discount, gross_sales, sales_entry_payments(method, amount)")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) notFound();
  const payments = ((data as unknown as { sales_entry_payments?: { method: string; amount: number }[] }).sales_entry_payments ?? [])
    .map((p) => ({ method: p.method, amount: Number(p.amount) }));
  const { data: pmData } = await supabase.from("payment_methods").select("name").order("name");
  const paymentMethods = (pmData ?? []).map((m: { name: string }) => m.name);

  return (
    <div className="flex flex-col flex-1 gap-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2">
          <Link href={`/sales/${id}`}><ArrowLeft className="size-4" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Edit sales entry</h1>
      </div>
      <SalesEditForm
        id={id}
        grossSales={Number(data.gross_sales)}
        paymentMethods={paymentMethods}
        initial={{
          entry_date: data.entry_date,
          shift: data.shift ?? "",
          notes: data.notes ?? "",
          total_discount: Number(data.total_discount ?? 0),
          payments,
        }}
      />
    </div>
  );
}
