"use client";

import { useState, useTransition, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { compatibleUnits, formatNum, parseDecimal } from "@/lib/units";
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
  onHand: number;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function QuickAdjustDialog({ open, onOpenChange, itemId, itemName, itemUnit, onHand }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [direction, setDirection] = useState<"in" | "out">("in");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState(itemUnit);
  const [reason, setReason] = useState("");

  const units = compatibleUnits(itemUnit as UnitCode);
  const reasons = direction === "in" ? IN_REASONS : OUT_REASONS;

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setDirection("in");
      setQty("");
      setUnit(itemUnit);
      setReason("");
    }
  }, [open, itemUnit]);

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
        reason,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Item name + current stock */}
          <div className="rounded-md bg-muted px-3 py-2.5 space-y-0.5">
            <p className="text-sm font-medium">{itemName}</p>
            <p className="text-xs text-muted-foreground">
              Current on hand: <span className="tabular-nums font-medium text-foreground">{formatNum(onHand)} {itemUnit}</span>
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
                  <span className="text-sm font-medium capitalize">{d}</span>
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
                placeholder="0"
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
                <div className="border rounded-md px-3 py-2 text-sm bg-muted text-muted-foreground">
                  {unit}
                </div>
              )}
            </div>
          </div>

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
