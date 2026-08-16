"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseDecimal, unitOptionsForItem, convertToItemUnit } from "@/lib/units";
import { Qty } from "@/components/ui/qty";
import { createStockAdjustment } from "@/app/actions/stock";
import type { UnitCode } from "@/lib/supabase/types";

const IN_REASONS = ["Initial stock", "Restock", "Correction", "Other"];
const OUT_REASONS = ["Wastage / spoilage", "Expired", "Sample / testing", "Correction", "Other"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemName: string;
  itemUnit: string;
  unitConversions?: { from_unit: string; factor: number; to_unit: string }[];
  purchaseUnit?: string | null;
  purchaseUnitQty?: number | null;
  onHand: number;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function QuickAdjustDialog({
  open,
  onOpenChange,
  itemId,
  itemName,
  itemUnit,
  unitConversions = [],
  purchaseUnit = null,
  purchaseUnitQty = null,
  onHand,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [direction, setDirection] = useState<"in" | "out">("in");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState(itemUnit);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const units = unitOptionsForItem({
    unit: itemUnit as UnitCode,
    purchase_unit: purchaseUnit,
    item_unit_conversions: unitConversions,
  });
  const reasons = direction === "in" ? IN_REASONS : OUT_REASONS;

  const qtyNum = parseDecimal(qty);
  const deltaInBaseUnit = !isNaN(qtyNum) && qtyNum > 0
    ? convertToItemUnit(qtyNum, unit as UnitCode, {
        unit: itemUnit as UnitCode,
        purchase_unit: purchaseUnit as UnitCode | null,
        purchase_unit_qty: purchaseUnitQty,
        item_unit_conversions: unitConversions,
      })
    : 0;
  const newOnHand = direction === "in" ? onHand + deltaInBaseUnit : onHand - deltaInBaseUnit;

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setDirection("in");
      setQty("");
      setUnit(itemUnit);
      setReason("");
      setNote("");
    }
    onOpenChange(nextOpen);
  }

  // Reset reason when direction changes
  function handleDirectionChange(d: "in" | "out") {
    setDirection(d);
    setReason("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!qty || parseDecimal(qty) <= 0) { toast.error("Enter a valid quantity"); return; }
    if (!reason) { toast.error("Select a reason"); return; }

    start(async () => {
      const res = await createStockAdjustment({
        direction,
        reason: note.trim() ? `${reason} — ${note.trim()}` : reason,
        adjustment_date: today(),
        items: [{ item_id: itemId, qty: parseDecimal(qty), unit }],
      });

      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`Stock ${direction === "in" ? "added" : "reduced"}`);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Item name + current stock */}
          <div className="rounded-md bg-muted px-3 py-2.5 space-y-0.5">
            <p className="text-sm font-medium">{itemName}</p>
            <p className="text-sm text-muted-foreground">
              Current on hand: <span className="tabular-nums font-medium text-foreground"><Qty value={onHand} unit={itemUnit} /></span>
            </p>
          </div>

          {/* Direction */}
          <div className="space-y-2">
            <Label>Direction</Label>
            <div className="flex gap-4">
              {(["in", "out"] as const).map((d) => (
                <label key={d} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="direction"
                    value={d}
                    checked={direction === d}
                    onChange={() => handleDirectionChange(d)}
                    className="accent-primary"
                  />
                  <span className="text-sm font-medium">{d === "in" ? "Stock in" : "Stock out"}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Qty + Unit */}
          <div className="flex gap-2">
            <div className="space-y-2 flex-1">
              <Label htmlFor="qa-qty">Quantity</Label>
              <DecimalInput
                id="qa-qty"
                min="0"
                step="any"
                value={qty}
                onValueChange={(v) => setQty(v)}
                autoFocus
              />
            </div>
            <div className="space-y-2 w-24">
              <Label>Unit</Label>
              {units.length > 1 ? (
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="h-8 flex items-center rounded-lg border border-input px-2.5 text-sm bg-muted text-muted-foreground">
                  {unit}
                </div>
              )}
            </div>
          </div>

          {qtyNum > 0 && (
            <p className="text-sm text-muted-foreground">
              New on hand: <span className="tabular-nums font-medium text-foreground"><Qty value={newOnHand} unit={itemUnit} /></span>
            </p>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="qa-note">Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              id="qa-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={280}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
