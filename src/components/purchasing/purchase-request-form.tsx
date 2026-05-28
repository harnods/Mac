"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Check, ChevronsUpDown, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DecimalInput } from "@/components/ui/decimal-input";
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
import { compatibleUnits, convert, formatNum } from "@/lib/units";
import { createPurchaseRequest, updatePurchaseRequest } from "@/app/actions/purchasing";
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

type ItemStock = {
  id: string;
  name: string;
  unit: string;
  on_hand: number;
  reserved: number;
  type: string;
};

type RequestRow = {
  key: string;
  item_id: string | null;
  qty: string;
  unit: string | null;
};

function newRow(): RequestRow {
  return { key: crypto.randomUUID(), item_id: null, qty: "", unit: null };
}

type Props = {
  items: ItemStock[];
  requestId?: string;
  initialNote?: string;
  initialRows?: { item_id: string; qty: string; unit: string }[];
};

export function PurchaseRequestForm({ items, requestId, initialNote, initialRows }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState(initialNote ?? "");
  const [rows, setRows] = useState<RequestRow[]>(
    initialRows && initialRows.length > 0
      ? [...initialRows.map((r) => ({ key: crypto.randomUUID(), item_id: r.item_id, qty: r.qty, unit: r.unit })), newRow()]
      : [newRow()]
  );
  const [draftMode, setDraftMode] = useState(false);

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function updateRow(key: string, patch: Partial<RequestRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function handleItemSelect(key: string, itemId: string) {
    const item = items.find((i) => i.id === itemId);
    updateRow(key, { item_id: itemId, unit: item?.unit ?? null });
    // Ensure trailing empty row
    setRows((prev) => {
      const last = prev[prev.length - 1];
      return last.item_id && last.key !== key ? [...prev, newRow()] : prev;
    });
  }

  // Called when multi-select picker closes with selected item IDs
  function handleMultiItemSelect(key: string, itemIds: string[]) {
    if (itemIds.length === 0) return;
    // Filter out items already used in other rows
    const otherUsed = new Set(rows.filter((r) => r.key !== key && r.item_id).map((r) => r.item_id!));
    const filtered = itemIds.filter((id) => !otherUsed.has(id));
    if (filtered.length === 0) return;
    const [first, ...rest] = filtered;
    // Set first item on current row
    const firstItem = items.find((i) => i.id === first);
    updateRow(key, { item_id: first, unit: firstItem?.unit ?? null });
    // Add new rows for remaining items
    if (rest.length > 0) {
      setRows((prev) => {
        const idx = prev.findIndex((r) => r.key === key);
        const newRows = rest.map((id) => {
          const it = items.find((i) => i.id === id);
          return { ...newRow(), item_id: id, unit: it?.unit ?? null };
        });
        const updated = [...prev.slice(0, idx + 1), ...newRows, ...prev.slice(idx + 1)];
        // Ensure there's always a trailing empty row
        const last = updated[updated.length - 1];
        if (last.item_id) updated.push(newRow());
        return updated;
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

  function submit(e: React.FormEvent, asDraft: boolean) {
    e.preventDefault();
    const payload = {
      note: note.trim() || undefined,
      items: rows
        .filter((r) => r.item_id)
        .map((r) => ({
          item_id: r.item_id!,
          qty: r.qty || undefined,
          unit: r.unit || undefined,
        })),
      draft: asDraft,
    };
    start(async () => {
      const res = requestId
        ? await updatePurchaseRequest(requestId, payload)
        : await createPurchaseRequest(payload);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(asDraft ? "Draft saved" : "Purchase request submitted");
      router.push(`/purchasing/requests/${res.id ?? requestId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={(e) => submit(e, draftMode)} className="space-y-6">
      <div className="space-y-3">
        <Label>Items to purchase</Label>
        <div className="space-y-6">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={rows.map((r) => r.key)} strategy={verticalListSortingStrategy}>
              {rows.map((row, idx) => {
                // Items already used in other rows (not this one)
                const usedItemIds = new Set(
                  rows.filter((r) => r.key !== row.key && r.item_id).map((r) => r.item_id!)
                );
                const isTrailingEmpty = !row.item_id && idx === rows.length - 1;
                return (
                  <RequestRowField
                    key={row.key}
                    id={row.key}
                    row={row}
                    index={idx}
                    canDrag={!isTrailingEmpty}
                    items={items.filter((i) => !usedItemIds.has(i.id) || i.id === row.item_id)}
                    onItemSelect={(id) => handleItemSelect(row.key, id)}
                    onMultiItemSelect={(ids) => handleMultiItemSelect(row.key, ids)}
                    onQtyChange={(qty) => updateRow(row.key, { qty })}
                    onUnitChange={(unit) => updateRow(row.key, { unit })}
                    onRemove={rows.length > 1 ? () => removeRow(row.key) : undefined}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">Note</Label>
        <Textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={500}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="outline"
          disabled={pending}
          onClick={() => setDraftMode(true)}
        >
          {pending && draftMode ? "Saving..." : "Save as draft"}
        </Button>
        <Button
          type="submit"
          disabled={pending}
          onClick={() => setDraftMode(false)}
        >
          {pending && !draftMode ? "Submitting..." : "Submit request"}
        </Button>
      </div>
    </form>
  );
}

function RequestRowField({
  id,
  row,
  index,
  canDrag,
  items,
  onItemSelect,
  onMultiItemSelect,
  onQtyChange,
  onUnitChange,
  onRemove,
}: {
  id: string;
  row: RequestRow;
  index: number;
  canDrag: boolean;
  items: ItemStock[];
  onItemSelect: (id: string) => void;
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

  function handleOpenChange(open: boolean) {
    if (open) {
      // Pre-select current item if any
      setPendingIds(row.item_id ? [row.item_id] : []);
    } else {
      // On close: cancel (don't apply pending)
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

  const selectedItem = items.find((i) => i.id === row.item_id) ?? null;
  const units = selectedItem ? compatibleUnits(selectedItem.unit) : [];
  const displayUnit = row.unit ?? selectedItem?.unit ?? null;

  const onHand = selectedItem
    ? (convert(Number(selectedItem.on_hand), selectedItem.unit, displayUnit!) ?? Number(selectedItem.on_hand))
    : null;
  const reserved = selectedItem
    ? (convert(Number(selectedItem.reserved), selectedItem.unit, displayUnit!) ?? Number(selectedItem.reserved))
    : null;
  const available = onHand != null && reserved != null ? onHand - reserved : null;

  return (
    <div ref={setNodeRef} style={style} className="space-y-1">
      <div className="flex items-center gap-2">
        {/* Drag handle */}
        {canDrag ? (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab text-muted-foreground hover:text-foreground shrink-0 touch-none"
            tabIndex={-1}
            aria-label="Drag to reorder"
          >
            <GripVertical className="size-4" />
          </button>
        ) : (
          <div className="size-4 shrink-0" />
        )}

        <span className="text-sm text-muted-foreground w-5 text-right shrink-0">{index + 1}.</span>

        {/* Item picker — multi-select */}
        <Popover open={itemOpen} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              className="flex-1 justify-between font-normal min-w-0"
            >
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
                      <span className="w-16 text-xs text-muted-foreground capitalize text-right shrink-0">{item.type}</span>
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
                {pendingIds.length > 0 ? `Add ${pendingIds.length} item${pendingIds.length > 1 ? "s" : ""}` : "Select items"}
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Qty */}
        <DecimalInput
          min="0"
          step="any"
          value={row.qty}
          onValueChange={(v) => onQtyChange(v)}
          className="w-24 shrink-0"
        />

        {/* Unit */}
        <Popover open={unitOpen} onOpenChange={setUnitOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              disabled={!selectedItem}
              className="w-24 shrink-0 justify-between font-normal px-2"
            >
              <span className={cn(!row.unit && "text-muted-foreground")}>
                {row.unit ?? "Unit"}
              </span>
              <ChevronsUpDown className="size-3.5 opacity-50 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-36 p-0" align="start">
            <Command>
              <CommandList>
                <CommandGroup>
                  {units.map((u) => (
                    <CommandItem
                      key={u}
                      value={u}
                      onSelect={() => { onUnitChange(u); setUnitOpen(false); }}
                    >
                      <Check className={cn("size-4", row.unit === u ? "opacity-100" : "opacity-0")} />
                      {u}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Remove */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={!onRemove}
          className="shrink-0 text-muted-foreground"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {/* Current stock display */}
      {selectedItem && displayUnit && (
        <div className="ml-14 flex gap-4 text-xs text-muted-foreground">
          <span>On hand: <span className="tabular-nums font-medium text-foreground">{formatNum(onHand!)} {displayUnit}</span></span>
          <span>Reserved: <span className="tabular-nums font-medium text-foreground">{formatNum(reserved!)} {displayUnit}</span></span>
          <span>Available: <span className="tabular-nums font-medium text-foreground">{formatNum(available!)} {displayUnit}</span></span>
        </div>
      )}

    </div>
  );
}
