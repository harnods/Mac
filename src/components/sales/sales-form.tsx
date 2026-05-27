"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { compatibleUnits, formatNum } from "@/lib/units";
import { createSalesEntry } from "@/app/actions/sales";

type Product = { id: string; name: string; unit: string };
type Row = { key: string; product_id: string | null; qty: string; unit: string | null };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function newRow(): Row {
  return { key: crypto.randomUUID(), product_id: null, qty: "", unit: null };
}

export function SalesForm({ products }: { products: Product[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [entryDate, setEntryDate] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([newRow()]);

  function addRow() { setRows((p) => [...p, newRow()]); }
  function removeRow(key: string) { setRows((p) => p.filter((r) => r.key !== key)); }
  function updateRow(key: string, patch: Partial<Row>) {
    setRows((p) => p.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function handleSubmit() {
    const validRows = rows.filter((r) => r.product_id && r.qty && r.unit);
    if (!validRows.length) { toast.error("Add at least one product with a quantity"); return; }

    start(async () => {
      const res = await createSalesEntry({
        entry_date: entryDate,
        notes: notes || undefined,
        items: validRows.map((r) => ({
          product_id: r.product_id!,
          qty: Number(r.qty),
          unit: r.unit!,
        })),
      });

      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Sales entry recorded");
      router.push(`/sales/${res.id}`);
    });
  }

  const totalItems = rows.filter((r) => r.product_id && r.qty).length;

  return (
    <div className="space-y-6">
      {/* Header fields */}
      <div className="max-w-lg space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="entry-date">Date</Label>
            <Input
              id="entry-date"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={500}
          />
        </div>
      </div>

      {/* Products sold */}
      <div className="space-y-3">
        <Label>Products sold</Label>
        <div className="border table-outer rounded-lg overflow-hidden">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="w-32">Qty sold</TableHead>
                <TableHead className="w-24">Unit</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => (
                <SalesRowField
                  key={row.key}
                  row={row}
                  index={idx}
                  products={products.filter(
                    (p) => !rows.some((r) => r.key !== row.key && r.product_id === p.id) || p.id === row.product_id
                  )}
                  onProductSelect={(id) => {
                    const product = products.find((p) => p.id === id);
                    updateRow(row.key, { product_id: id, unit: product?.unit ?? null });
                  }}
                  onQtyChange={(qty) => updateRow(row.key, { qty })}
                  onUnitChange={(unit) => updateRow(row.key, { unit })}
                  onRemove={rows.length > 1 ? () => removeRow(row.key) : undefined}
                />
              ))}
            </TableBody>
          </Table>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="size-4" /> Add product
        </Button>
      </div>

      {/* Summary */}
      {totalItems > 0 && (
        <p className="text-sm text-muted-foreground">
          {totalItems} product{totalItems !== 1 ? "s" : ""} — stock will be deducted from ingredients and prep items based on each product&apos;s recipe.
        </p>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.push("/sales")} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={pending}>
          {pending ? "Recording..." : "Record sales"}
        </Button>
      </div>
    </div>
  );
}

function SalesRowField({
  row, index, products, onProductSelect, onQtyChange, onUnitChange, onRemove,
}: {
  row: Row;
  index: number;
  products: Product[];
  onProductSelect: (id: string) => void;
  onQtyChange: (qty: string) => void;
  onUnitChange: (unit: string) => void;
  onRemove?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);

  const selectedProduct = products.find((p) => p.id === row.product_id) ?? null;
  const units = selectedProduct ? compatibleUnits(selectedProduct.unit) : [];

  return (
    <TableRow>
      <TableCell className="text-muted-foreground text-sm tabular-nums">{index + 1}</TableCell>

      <TableCell>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" role="combobox"
              className="w-full justify-between font-normal">
              <span className={cn("truncate", !selectedProduct && "text-muted-foreground")}>
                {selectedProduct ? selectedProduct.name : "Select product"}
              </span>
              <ChevronsUpDown className="size-4 opacity-50 shrink-0 ml-1" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search products..." />
              <CommandList>
                <CommandEmpty>No products found.</CommandEmpty>
                <CommandGroup>
                  {products.map((p) => (
                    <CommandItem key={p.id} value={p.name}
                      onSelect={() => { onProductSelect(p.id); setOpen(false); }}>
                      <Check className={cn("size-4", row.product_id === p.id ? "opacity-100" : "opacity-0")} />
                      {p.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </TableCell>

      <TableCell>
        <Input
          type="number" inputMode="decimal" min="0" step="any"
          value={row.qty}
          onChange={(e) => onQtyChange(e.target.value)}
          className="w-full"
        />
      </TableCell>

      <TableCell>
        <Popover open={unitOpen} onOpenChange={setUnitOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" role="combobox"
              disabled={!selectedProduct}
              className="w-full justify-between font-normal px-2">
              <span className={cn(!row.unit && "text-muted-foreground")}>{row.unit ?? "Unit"}</span>
              <ChevronsUpDown className="size-3.5 opacity-50 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-36 p-0" align="start">
            <Command>
              <CommandList>
                <CommandGroup>
                  {units.map((u) => (
                    <CommandItem key={u} value={u}
                      onSelect={() => { onUnitChange(u); setUnitOpen(false); }}>
                      <Check className={cn("size-4", row.unit === u ? "opacity-100" : "opacity-0")} />
                      {u}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </TableCell>

      <TableCell className="px-2">
        <Button type="button" variant="ghost" size="icon"
          onClick={onRemove} disabled={!onRemove}
          className="text-muted-foreground">
          <Trash2 className="size-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
