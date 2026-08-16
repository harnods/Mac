"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  STICKY_ACTION_HEAD,
  STICKY_ACTION_CELL,
} from "@/components/ui/table";
import { UnitCombobox } from "@/components/inventory/unit-combobox";
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
  units = [],
}: {
  itemId: string;
  itemUnit: UnitCode;
  conversions: UnitConversionRow[];
  canEdit: boolean;
  /** Master unit codes for the conversion-unit picker (supports inline create). */
  units?: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [fromUnit, setFromUnit] = useState("");
  const [factor, setFactor] = useState("");
  const [toUnit, setToUnit] = useState(itemUnit);
  const [unitList, setUnitList] = useState<string[]>(units);
  // Target unit can be the base unit / a group unit, OR an existing conversion
  // unit (nested chains, e.g. "1 karton = 12 box" where "1 box = 1000 ml").
  const toUnitOptions = [...new Set([...compatibleUnits(itemUnit), ...conversions.map((c) => c.from_unit)])];

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
      setOpen(false);
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

  const filteredConversions = conversions.filter((c) =>
    c.from_unit.toLowerCase().includes(q.toLowerCase()) ||
    c.to_unit.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> Add unit conversion
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add unit conversion</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Conversion unit</Label>
                  <UnitCombobox
                    units={unitList}
                    onUnitsChange={setUnitList}
                    value={fromUnit}
                    onChange={setFromUnit}
                    placeholder="Select or create unit"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Label>Quantity</Label>
                    <DecimalInput
                      value={factor}
                      onValueChange={setFactor}
                      className="h-10 text-right"
                    />
                  </div>
                  <div className="w-24 space-y-1.5">
                    <Label>Unit</Label>
                    <Select value={toUnit} onValueChange={setToUnit}>
                      <SelectTrigger className="h-10">
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
                </div>
                <p className="text-xs text-muted-foreground">
                  1 {fromUnit || "unit"} = {factor.trim() || "0"} {toUnit}
                </p>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="ghost">Cancel</Button>
                  </DialogClose>
                  <Button type="submit" disabled={pending}>
                    {pending ? "Adding..." : "Add"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      <div className="flex justify-end">
        <Input
          placeholder="Search conversions..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full sm:w-56"
        />
      </div>

      {filteredConversions.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          {conversions.length === 0 ? "No unit conversions yet." : "No matching conversions."}
        </div>
      ) : (
        <div className="table-outer overflow-x-auto rounded-lg border">
          <Table className="w-auto min-w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[240px]">Conversion</TableHead>
                <TableHead className="w-0 p-0" />
                <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredConversions.map((conversion) => (
                <TableRow key={conversion.id}>
                  <TableCell className="font-medium">
                    1 {conversion.from_unit} = {formatNum(Number(conversion.factor))} {conversion.to_unit}
                  </TableCell>
                  <TableCell />
                  <TableCell className={STICKY_ACTION_CELL}>
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
