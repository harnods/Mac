"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createItemUnitConversion, deleteItemUnitConversion } from "@/app/actions/inventory";
import { compatibleUnits, formatNum, parseDecimal } from "@/lib/units";
import type { UnitCode } from "@/lib/supabase/types";

export type UnitConversionRow = {
  id: string;
  from_unit: UnitCode;
  factor: number;
  to_unit: UnitCode;
};

export function UnitConversionsPanel({
  itemId,
  itemUnit,
  conversions,
  canEdit,
}: {
  itemId: string;
  itemUnit: UnitCode;
  conversions: UnitConversionRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fromUnit, setFromUnit] = useState("");
  const [factor, setFactor] = useState("");
  const [toUnit, setToUnit] = useState(itemUnit);
  const toUnitOptions = compatibleUnits(itemUnit);

  function resetForm() {
    setFromUnit("");
    setFactor("");
    setToUnit(itemUnit);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const unit = fromUnit.trim().toLowerCase();
    const qty = parseDecimal(factor);
    if (!unit) {
      toast.error("Enter a conversion unit");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }

    startTransition(async () => {
      const res = await createItemUnitConversion({
        item_id: itemId,
        from_unit: unit,
        factor: qty,
        to_unit: toUnit,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Unit conversion added");
      resetForm();
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteItemUnitConversion(id, itemId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Unit conversion deleted");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(12rem,1fr)_auto_minmax(8rem,12rem)_6rem_auto]"
        >
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Conversion unit</label>
            <Input
              value={fromUnit}
              onChange={(event) => setFromUnit(event.target.value)}
              placeholder="box"
              maxLength={30}
            />
          </div>
          <div className="hidden h-8 items-center text-sm text-muted-foreground sm:flex">=</div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Quantity</label>
            <DecimalInput
              value={factor}
              onValueChange={setFactor}
              placeholder="1"
              className="text-right"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Base unit</label>
            <Select value={toUnit} onValueChange={setToUnit}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {toUnitOptions.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={pending} className="sm:self-end">
            <Plus className="size-4" /> Add
          </Button>
        </form>
      )}

      {conversions.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          No unit conversions yet.
        </div>
      ) : (
        <div className="table-outer overflow-x-auto rounded-lg border">
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Conversion</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {conversions.map((conversion) => (
                <TableRow key={conversion.id}>
                  <TableCell className="font-medium">
                    1 {conversion.from_unit} = {formatNum(Number(conversion.factor))} {conversion.to_unit}
                  </TableCell>
                  <TableCell className="text-right">
                    {canEdit && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={pending}
                        onClick={() => handleDelete(conversion.id)}
                        aria-label={`Delete ${conversion.from_unit} conversion`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
