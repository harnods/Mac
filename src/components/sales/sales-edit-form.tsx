"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseDecimal } from "@/lib/units";
import { formatRp } from "@/lib/format";
import { updateSalesEntry } from "@/app/actions/sales";

const SERVICE_CHARGE_RATE = 0.05;
const TAX_RATE = 0.10;

export function SalesEditForm({
  id,
  grossSales,
  paymentMethods,
  initial,
}: {
  id: string;
  grossSales: number;
  paymentMethods: string[];
  initial: { entry_date: string; shift: string; notes: string; total_discount: number; payments: { method: string; amount: number }[] };
}) {
  // Include any already-recorded methods that are no longer in the master list.
  const methodOptions = [...new Set([...paymentMethods, ...initial.payments.map((p) => p.method)])];
  const router = useRouter();
  const [pending, start] = useTransition();
  const [entryDate, setEntryDate] = useState(initial.entry_date);
  const [shift, setShift] = useState(initial.shift);
  const [notes, setNotes] = useState(initial.notes);
  const [discountText, setDiscountText] = useState(initial.total_discount ? String(initial.total_discount) : "");
  const [payments, setPayments] = useState<{ key: string; method: string; amount: string }[]>(
    initial.payments.length
      ? initial.payments.map((p) => ({ key: crypto.randomUUID(), method: p.method, amount: String(p.amount) }))
      : [{ key: crypto.randomUUID(), method: "", amount: "" }],
  );

  const discount = Math.min(discountText.trim() ? parseDecimal(discountText) : 0, grossSales);
  const serviceCharge = Math.round(grossSales * SERVICE_CHARGE_RATE);
  const taxTotal = Math.round((grossSales - discount + serviceCharge) * TAX_RATE);
  const netSales = grossSales - discount + serviceCharge + taxTotal;

  const filledPayments = payments.filter((p) => p.method.trim() && p.amount.trim());
  const allocated = filledPayments.reduce((s, p) => s + parseDecimal(p.amount), 0);
  const paymentRemaining = netSales - allocated;
  const paymentsBalanced = filledPayments.length === 0 || Math.round(allocated) === Math.round(netSales);

  function handleSubmit() {
    if (!paymentsBalanced) { toast.error("Payment total must equal net sales"); return; }
    start(async () => {
      const res = await updateSalesEntry(id, {
        entry_date: entryDate,
        shift: shift || undefined,
        total_discount: discountText.trim() ? parseDecimal(discountText) : 0,
        payments: filledPayments.map((p) => ({ method: p.method.trim(), amount: parseDecimal(p.amount) })),
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

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Payment methods</h2>
        <div className="space-y-2">
          {payments.map((p) => (
            <div key={p.key} className="flex items-center gap-2">
              <Select value={p.method || undefined} onValueChange={(v) => setPayments((prev) => prev.map((x) => (x.key === p.key ? { ...x, method: v } : x)))}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Select payment method" /></SelectTrigger>
                <SelectContent>
                  {methodOptions.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="w-40">
                <DecimalInput
                  value={p.amount}
                  onValueChange={(v) => setPayments((prev) => prev.map((x) => (x.key === p.key ? { ...x, amount: v } : x)))}
                  className="h-10 text-right"
                />
              </div>
              <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:text-destructive"
                onClick={() => setPayments((prev) => (prev.length > 1 ? prev.filter((x) => x.key !== p.key) : prev))}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setPayments((prev) => [...prev, { key: crypto.randomUUID(), method: "", amount: "" }])}>
          <Plus className="size-4" /> Add payment method
        </Button>
        <div className={cn("flex items-center justify-between text-sm rounded-md px-3 py-2", paymentsBalanced ? "bg-muted/40" : "bg-destructive/10 text-destructive")}>
          <span>Allocated {formatRp(allocated)} / Net {formatRp(netSales)}</span>
          <span className="tabular-nums font-medium">
            {paymentRemaining === 0 ? "Balanced" : `${paymentRemaining > 0 ? "Remaining" : "Over"} ${formatRp(Math.abs(paymentRemaining))}`}
          </span>
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.push(`/sales/${id}`)} disabled={pending}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={pending || !paymentsBalanced}>{pending ? "Saving..." : "Save changes"}</Button>
      </div>
    </div>
  );
}
