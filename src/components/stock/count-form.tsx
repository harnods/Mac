"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNum, parseDecimal } from "@/lib/units";
import { createStockCount } from "@/app/actions/stock";

type Item = { id: string; name: string; unit: string; type: string; on_hand: number };

type CountRow = {
  item_id: string;
  item_name: string;
  unit: string;
  qty_system: number;
  qty_counted: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function CountForm({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [countDate, setCountDate] = useState(today());
  const [note, setNote] = useState("");

  const [rows, setRows] = useState<CountRow[]>(
    items.map((it) => ({
      item_id: it.id,
      item_name: it.name,
      unit: it.unit,
      qty_system: Number(it.on_hand),
      qty_counted: "",
    }))
  );

  function updateCounted(item_id: string, value: string) {
    setRows((prev) =>
      prev.map((r) => (r.item_id === item_id ? { ...r, qty_counted: value } : r))
    );
  }

  function submit(complete: boolean) {
    if (complete) {
      const anyEmpty = rows.some((r) => r.qty_counted === "");
      if (anyEmpty) {
        toast.error("Fill in counted qty for all items before completing");
        return;
      }
    }

    start(async () => {
      const res = await createStockCount({
        count_date: countDate,
        note: note.trim() || undefined,
        items: rows.map((r) => ({
          item_id: r.item_id,
          qty_system: r.qty_system,
          qty_counted: r.qty_counted !== "" ? parseDecimal(r.qty_counted) : null,
          unit: r.unit,
        })),
        complete,
      });

      if (!res.ok) { toast.error(res.error); return; }
      toast.success(complete ? "Stock count completed — on_hand updated" : "Draft saved");
      router.push(complete ? `/stock/counts/${res.id}` : "/stock/counts");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Header fields */}
      <div className="max-w-lg space-y-4">
        <div className="space-y-2">
          <Label htmlFor="count-date">Count date</Label>
          <Input
            id="count-date"
            type="date"
            required
            value={countDate}
            onChange={(e) => setCountDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="count-note">Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Textarea
            id="count-note"
            placeholder="e.g. Month-end stockopname"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={2}
          />
          <p className="text-xs text-muted-foreground text-right">{note.length}/500</p>
        </div>
      </div>

      {/* Items table */}
      {rows.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
          No active items found.
        </div>
      ) : (
        <div className="border table-outer rounded-lg overflow-hidden">
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="w-20">Unit</TableHead>
                <TableHead className="w-32 text-right">System qty</TableHead>
                <TableHead className="w-36 text-center">Counted qty</TableHead>
                <TableHead className="w-32 text-right">Discrepancy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const counted = row.qty_counted !== "" ? parseDecimal(row.qty_counted) : null;
                const discrepancy = counted != null ? counted - row.qty_system : null;
                return (
                  <TableRow key={row.item_id}>
                    <TableCell className="font-medium truncate">{row.item_name}</TableCell>
                    <TableCell>{row.unit}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNum(row.qty_system)}
                    </TableCell>
                    <TableCell>
                      <DecimalInput
                        min="0"
                        step="any"
                        placeholder="—"
                        value={row.qty_counted}
                        onValueChange={(v) => updateCounted(row.item_id, v)}
                        className="w-full text-center"
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {discrepancy == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={cn(
                            "font-medium",
                            discrepancy > 0
                              ? "text-green-600 dark:text-green-400"
                              : discrepancy < 0
                              ? "text-destructive"
                              : "text-muted-foreground"
                          )}
                        >
                          {discrepancy > 0 ? "+" : ""}
                          {formatNum(discrepancy)}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => submit(false)}
        >
          {pending ? "Saving..." : "Save as draft"}
        </Button>
        <Button
          type="button"
          disabled={pending}
          onClick={() => submit(true)}
        >
          {pending ? "Saving..." : "Complete count"}
        </Button>
      </div>
    </div>
  );
}
