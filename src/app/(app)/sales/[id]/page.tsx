import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { formatId, formatDate, formatDateTime, updaterName } from "@/lib/format";
import { formatNum } from "@/lib/units";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Updater } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type SalesEntryDetail = {
  id: string;
  entry_date: string;
  notes: string | null;
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
  await getCurrentProfile();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sales_entries")
    .select(`
      id, entry_date, notes, created_at,
      creator:profiles!created_by(full_name,email),
      sales_entry_items(id, qty, unit, product:items!product_id(id,name))
    `)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) notFound();
  const entry = data as unknown as SalesEntryDetail;

  const totalProducts = entry.sales_entry_items.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2 mt-0.5">
          <Link href="/sales">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Sales entry{" "}
          <span className="text-muted-foreground font-normal">{formatId(id)}</span>
        </h1>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm max-w-lg">
        <span className="text-muted-foreground">Date</span>
        <span>{formatDate(entry.entry_date)}</span>

        <span className="text-muted-foreground">Products sold</span>
        <span className="tabular-nums">{totalProducts}</span>

        <span className="text-muted-foreground">Recorded by</span>
        <span>{updaterName(entry.creator)}</span>

        <span className="text-muted-foreground">Recorded at</span>
        <span>{formatDateTime(entry.created_at)}</span>

        {entry.notes && (
          <>
            <span className="text-muted-foreground">Notes</span>
            <span className="whitespace-pre-wrap">{entry.notes}</span>
          </>
        )}
      </div>

      {/* Products table */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium">Products sold</h2>
        {entry.sales_entry_items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No products recorded.</p>
        ) : (
          <div className="border table-outer rounded-lg overflow-x-auto">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="w-36">Qty sold</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entry.sales_entry_items.map((item, idx) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground text-sm tabular-nums">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {item.product?.name ?? "—"}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {formatNum(item.qty)} {item.unit}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
