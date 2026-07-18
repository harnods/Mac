"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Check, ChevronsUpDown, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { parseDecimal, unitOptionsForItem, convertToItemUnit, formatNum } from "@/lib/units";
import type { UnitCode } from "@/lib/supabase/types";
import { createStockAdjustment } from "@/app/actions/stock";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Item = {
  id: string;
  name: string;
  unit: string;
  type: string;
  on_hand: number;
  purchase_unit: string | null;
  purchase_unit_qty: number | null;
  item_unit_conversions: { from_unit: string; factor: number; to_unit: string }[];
};

type Row = { key: string; item_id: string | null; qty: string; unit: string | null };

const IN_REASONS = [
  "Initial stock",
  "Restock",
  "Correction",
  "Other",
];

const OUT_REASONS = [
  "Wastage / spoilage",
  "Expired",
  "Sample / testing",
  "Correction",
  "Other",
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function newRow(): Row {
  return { key: crypto.randomUUID(), item_id: null, qty: "", unit: null };
}

export function AdjustmentForm({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [date, setDate] = useState(today());
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [reason, setReason] = useState("");
  const [rows, setRows] = useState<Row[]>([newRow()]);

  const reasons = direction === "in" ? IN_REASONS : OUT_REASONS;

  function handleDirectionChange(d: "in" | "out") {
    setDirection(d);
    setReason(""); // reset reason when direction changes
  }

  function removeRow(key: string) {
    setRows((p) => {
      const filtered = p.filter((r) => r.key !== key);
      if (filtered.length === 0) return [newRow()];
      return filtered;
    });
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((p) => p.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function handleMultiItemSelect(key: string, itemIds: string[]) {
    if (itemIds.length === 0) return;
    const otherUsed = new Set(rows.filter((r) => r.key !== key && r.item_id).map((r) => r.item_id!));
    const filtered = itemIds.filter((id) => !otherUsed.has(id));
    if (filtered.length === 0) return;
    const [first, ...rest] = filtered;
    const firstItem = items.find((i) => i.id === first);
    updateRow(key, { item_id: first, unit: firstItem?.unit ?? null });
    if (rest.length > 0) {
      setRows((prev) => {
        const idx = prev.findIndex((r) => r.key === key);
        const newRows = rest.map((id) => {
          const it = items.find((i) => i.id === id);
          return { ...newRow(), item_id: id, unit: it?.unit ?? null } as Row;
        });
        const updated = [...prev.slice(0, idx + 1), ...newRows, ...prev.slice(idx + 1)];
        const last = updated[updated.length - 1];
        if (last.item_id) updated.push(newRow());
        return updated;
      });
    } else {
      setRows((prev) => {
        const last = prev[prev.length - 1];
        if (last.item_id) return [...prev, newRow()];
        return prev;
      });
    }
  }

  // DnD setup
  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setRows((prev) => {
        const oldIdx = prev.findIndex((r) => r.key === active.id);
        const newIdx = prev.findIndex((r) => r.key === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const validRows = rows.filter((r) => r.item_id && r.qty && r.unit);
    if (!validRows.length) { toast.error("Add at least one item with a quantity"); return; }
    if (!reason) { toast.error("Select a reason"); return; }

    start(async () => {
      const res = await createStockAdjustment({
        direction,
        reason,
        adjustment_date: date,
        items: validRows.map((r) => ({
          item_id: r.item_id!,
          qty: parseDecimal(r.qty),
          unit: r.unit!,
        })),
      });

      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`Stock ${direction} recorded`);
      router.push("/stock/adjustments");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col flex-1 gap-6">
      {/* Header fields */}
      <div className="max-w-lg grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="adj-date">Date</Label>
          <Input
            id="adj-date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Direction</Label>
          <div className="flex gap-3 pt-0.5">
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

        <div className="space-y-2 col-span-2">
          <Label>Reason</Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select reason..." />
            </SelectTrigger>
            <SelectContent>
              {reasons.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {reason === "Initial stock" && (
            <p className="text-xs text-muted-foreground">
              Use this only for items that have no existing stock.
            </p>
          )}
        </div>
      </div>

      {/* Items table */}
      <div className="space-y-3">
        <Label>Items</Label>
        <div className="border table-outer rounded-lg overflow-hidden">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead className="w-8">#</TableHead>
                <TableHead className="w-[40%]">Item</TableHead>
                <TableHead className="w-[15%] text-center">Qty</TableHead>
                <TableHead className="w-[12%] text-center">Unit</TableHead>
                <TableHead className="w-[18%] text-right">New on hand</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={rows.map((r) => r.key)} strategy={verticalListSortingStrategy}>
                  {rows.map((row, idx) => {
                    const isTrailingEmpty = !row.item_id && idx === rows.length - 1;
                    return (
                      <AdjustmentRowField
                        key={row.key}
                        id={row.key}
                        row={row}
                        index={idx}
                        canDrag={!isTrailingEmpty}
                        direction={direction}
                        items={items.filter((i) =>
                          !rows.some((r) => r.key !== row.key && r.item_id === i.id) || i.id === row.item_id
                        )}
                        onMultiItemSelect={(ids) => handleMultiItemSelect(row.key, ids)}
                        onQtyChange={(qty) => updateRow(row.key, { qty })}
                        onUnitChange={(unit) => updateRow(row.key, { unit })}
                        onRemove={rows.length > 1 ? () => removeRow(row.key) : undefined}
                      />
                    );
                  })}
                </SortableContext>
              </DndContext>
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Actions */}
      <div className="sticky bottom-0 z-10 mt-auto -mx-1 flex justify-end gap-2 border-t bg-background/95 px-1 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save adjustment"}
        </Button>
      </div>
    </form>
  );
}

function AdjustmentRowField({
  id,
  row,
  index,
  canDrag,
  direction,
  items,
  onMultiItemSelect,
  onQtyChange,
  onUnitChange,
  onRemove,
}: {
  id: string;
  row: Row;
  index: number;
  canDrag: boolean;
  direction: "in" | "out";
  items: Item[];
  onMultiItemSelect: (ids: string[]) => void;
  onQtyChange: (qty: string) => void;
  onUnitChange: (unit: string) => void;
  onRemove?: () => void;
}) {
  const [itemOpen, setItemOpen] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [pendingIds, setPendingIds] = useState<string[]>([]);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const selectedItem = items.find((i) => i.id === row.item_id) ?? null;
  const units = selectedItem ? unitOptionsForItem(selectedItem) : [];

  const qtyNum = parseDecimal(row.qty);
  const newOnHand = selectedItem && row.unit && !isNaN(qtyNum) && qtyNum > 0
    ? (() => {
        const delta = convertToItemUnit(qtyNum, row.unit as UnitCode, selectedItem);
        return direction === "in" ? selectedItem.on_hand + delta : selectedItem.on_hand - delta;
      })()
    : null;

  function handleOpenChange(open: boolean) {
    if (open) {
      setPendingIds(row.item_id ? [row.item_id] : []);
    } else {
      // On close without confirming: cancel (no-op)
      setPendingIds([]);
    }
    setItemOpen(open);
  }

  function toggleItem(itemId: string) {
    setPendingIds((prev) =>
      prev.includes(itemId) ? prev.filter((x) => x !== itemId) : [...prev, itemId]
    );
  }

  function confirmSelection() {
    if (pendingIds.length > 0) onMultiItemSelect(pendingIds);
    setPendingIds([]);
    setItemOpen(false);
  }

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="px-2 w-8">
        {canDrag ? (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab text-muted-foreground hover:text-foreground touch-none"
            tabIndex={-1}
            aria-label="Drag to reorder"
          >
            <GripVertical className="size-4" />
          </button>
        ) : (
          <div className="size-4" />
        )}
      </TableCell>

      <TableCell className="text-muted-foreground text-right">{index + 1}.</TableCell>

      <TableCell>
        <Popover open={itemOpen} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" role="combobox"
              className="w-full justify-between font-normal">
              <span className={cn("truncate", !selectedItem && "text-muted-foreground")}>
                {selectedItem ? selectedItem.name : "Select item"}
              </span>
              <ChevronsUpDown className="size-4 opacity-50 shrink-0 ml-1" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search items..." />
              <CommandList>
                <CommandEmpty>No items found.</CommandEmpty>
                <CommandGroup>
                  {items.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.name}
                      onSelect={() => toggleItem(item.id)}
                      className="flex items-center gap-2 py-1.5"
                    >
                      <Check className={cn("size-4 shrink-0", pendingIds.includes(item.id) ? "opacity-100" : "opacity-0")} />
                      <span className="flex-1 truncate">{item.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{item.type}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
            <div className="border-t p-2">
              <Button
                type="button"
                size="sm"
                className="w-full"
                disabled={pendingIds.length === 0}
                onClick={confirmSelection}
              >
                {pendingIds.length > 0
                  ? `Add ${pendingIds.length} item${pendingIds.length > 1 ? "s" : ""}`
                  : "Select items"}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </TableCell>

      <TableCell>
        <DecimalInput
          min="0" step="any"
          value={row.qty}
          onValueChange={(v) => onQtyChange(v)}
          className="w-full"
        />
      </TableCell>

      <TableCell>
        <Popover open={unitOpen} onOpenChange={setUnitOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" role="combobox"
              disabled={!selectedItem}
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

      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
        {newOnHand != null ? (
          <>{formatNum(newOnHand)} {selectedItem?.unit}</>
        ) : "—"}
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
