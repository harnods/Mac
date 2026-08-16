import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { formatId, formatDate, formatDateTime, updaterName, formatRp } from "@/lib/format";
import { DeleteSalesEntryButtonClient } from "@/components/sales/delete-sales-entry-button";
import { SalesEntryItemsTable } from "@/components/sales/sales-entry-items-table";
import { DetailSection, DetailRow } from "@/components/ui/detail-list";
import type { Updater } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type SalesEntryDetail = {
  id: string;
  entry_date: string;
  shift: string | null;
  notes: string | null;
  gross_sales: number;
  total_discount: number;
  service_charge: number;
  tax_total: number;
  net_sales: number;
  created_at: string;
  creator: Updater | null;
  sales_entry_items: {
    id: string;
    qty: number;
    unit: string;
    product: { id: string; name: string } | null;
  }[];
};

export default async function SalesEntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sales_entries")
    .select(`
      id, entry_date, shift, notes, gross_sales, total_discount, service_charge, tax_total, net_sales, created_at,
      creator:profiles!created_by(full_name,email),
      sales_entry_items(id, qty, unit, product:items!product_id(id,name))
    `)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) notFound();
  const entry = data as unknown as SalesEntryDetail;

  const totalProducts = entry.sales_entry_items.length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="-ml-2">
            <Link href="/sales">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Sales entry{" "}
            <span className="text-muted-foreground font-normal">{formatId(id)}</span>
          </h1>
        </div>
        {can(profile, P.SALES_WRITE) && <DeleteSalesEntryButtonClient id={id} />}
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 space-y-8 lg:col-span-6">
          <DetailSection title="Details">
            <DetailRow label="Date" value={formatDate(entry.entry_date)} />
            {entry.shift && <DetailRow label="Shift" value={entry.shift} />}
            <DetailRow label="Products sold" value={<span className="tabular-nums">{totalProducts}</span>} />
            <DetailRow label="Recorded by" value={updaterName(entry.creator)} />
            <DetailRow label="Recorded at" value={formatDateTime(entry.created_at)} />
            {entry.notes && (
              <DetailRow label="Notes" value={<span className="whitespace-pre-wrap">{entry.notes}</span>} />
            )}
          </DetailSection>

          <DetailSection title="Sales summary">
            <DetailRow label="Gross sales" value={<span className="tabular-nums">{formatRp(entry.gross_sales)}</span>} />
            {entry.total_discount > 0 && (
              <DetailRow label="Total discount" value={<span className="tabular-nums">− {formatRp(entry.total_discount)}</span>} />
            )}
            <DetailRow label="Service charge (5%)" value={<span className="tabular-nums">{formatRp(entry.service_charge)}</span>} />
            <DetailRow label="Tax (PB1 10%)" value={<span className="tabular-nums">{formatRp(entry.tax_total)}</span>} />
            <DetailRow label="Net sales" value={<span className="tabular-nums font-semibold">{formatRp(entry.net_sales)}</span>} />
          </DetailSection>
        </div>
      </div>

      {/* Products table */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Products sold</h2>
        {entry.sales_entry_items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No products recorded.</p>
        ) : (
          <SalesEntryItemsTable items={entry.sales_entry_items} />
        )}
      </section>
    </div>
  );
}
