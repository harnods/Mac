"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseDecimal } from "@/lib/units";
import { formatRp } from "@/lib/format";
import { updateSalesEntry } from "@/app/actions/sales";

const SERVICE_CHARGE_RATE = 0.05;
const TAX_RATE = 0.10;

export function SalesEditForm({
  id,
  grossSales,
  initial,
}: {
  id: string;
  grossSales: number;
  initial: { entry_date: string; shift: string; notes: string; total_discount: number };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [entryDate, setEntryDate] = useState(initial.entry_date);
  const [shift, setShift] = useState(initial.shift);
  const [notes, setNotes] = useState(initial.notes);
  const [discountText, setDiscountText] = useState(initial.total_discount ? String(initial.total_discount) : "");

  const discount = Math.min(discountText.trim() ? parseDecimal(discountText) : 0, grossSales);
  const serviceCharge = Math.round(grossSales * SERVICE_CHARGE_RATE);
  const taxTotal = Math.round((grossSales - discount + serviceCharge) * TAX_RATE);
  const netSales = grossSales - discount + serviceCharge + taxTotal;

  function handleSubmit() {
    start(async () => {
      const res = await updateSalesEntry(id, {
        entry_date: entryDate,
        shift: shift || undefined,
        total_discount: discountText.trim() ? parseDecimal(discountText) : 0,
        notes: notes || undefined,
      });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Sales entry updated");
      router.push(`/sales/${id}`);
    });
  }

  return (
    <div className="flex flex-col flex-1 gap-6 max-w-lg">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="entry-date">Date</Label>
            <Input id="entry-date" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shift">Shift</Label>
            <Input id="shift" value={shift} onChange={(e) => setShift(e.target.value)} placeholder="e.g. Morning, Evening" maxLength={60} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Sales summary</h2>
        <div className="space-y-2 rounded-lg border p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Gross sales</span>
            <span className="tabular-nums font-medium">{formatRp(grossSales)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="discount" className="text-muted-foreground font-normal">Total discount</Label>
            <div className="w-40"><DecimalInput id="discount" value={discountText} onValueChange={setDiscountText} className="h-9 text-right" /></div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Service charge (5%)</span>
            <span className="tabular-nums">{formatRp(serviceCharge)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Tax (PB1 10%)</span>
            <span className="tabular-nums">{formatRp(taxTotal)}</span>
          </div>
          <div className="flex items-center justify-between border-t pt-2">
            <span className="font-medium">Net sales</span>
            <span className="tabular-nums font-semibold">{formatRp(netSales)}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          To change the products sold, delete this entry and record a new one.
        </p>
      </section>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.push(`/sales/${id}`)} disabled={pending}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={pending}>{pending ? "Saving..." : "Save changes"}</Button>
      </div>
    </div>
  );
}
