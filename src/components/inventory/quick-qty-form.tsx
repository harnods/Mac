"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Label } from "@/components/ui/label";
import { updateItem } from "@/app/actions/inventory";
import type { UnitCode } from "@/lib/supabase/types";
import type { StockMode } from "@/lib/item-types";

export function QuickQtyForm({
  id,
  unit,
  onHand,
  reserved,
  stockMode = 'full',
}: {
  id: string;
  unit: UnitCode;
  onHand: number;
  reserved: number;
  stockMode?: StockMode;
}) {
  const router = useRouter();
  const [onHandVal, setOnHandVal] = useState(String(onHand));
  const [reservedVal, setReservedVal] = useState(String(reserved));
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await updateItem(id, { on_hand: onHandVal, reserved: stockMode === 'full' ? reservedVal : "0" });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Stock updated");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {stockMode === 'full' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="on-hand">On hand ({unit})</Label>
            <DecimalInput
              id="on-hand"
              min="0"
              step="any"
              value={onHandVal}
              onValueChange={(v) => setOnHandVal(v)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reserved">Reserved ({unit})</Label>
            <DecimalInput
              id="reserved"
              min="0"
              step="any"
              value={reservedVal}
              onValueChange={(v) => setReservedVal(v)}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="on-hand">Available ({unit})</Label>
          <DecimalInput
            id="on-hand"
            min="0"
            step="any"
            value={onHandVal}
            onValueChange={(v) => setOnHandVal(v)}
          />
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}
