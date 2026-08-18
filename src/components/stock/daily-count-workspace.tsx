"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Play, Plus, RefreshCw, Save, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNum, parseDecimal } from "@/lib/units";
import { expectedClosing, varianceOf } from "@/lib/daily-count";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { QuantityCalculatorInput } from "@/components/stock/quantity-calculator-input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  addDailyStockCountItems,
  finishDailyStockCount,
  getDailyCountOptions,
  refreshDailySoldQty,
  saveDailyStockCountDraft,
  startDailyStockCount,
  type AddedDailyCountItem,
  type DailyCountItemOption,
} from "@/app/actions/daily-stock";

type CountStatus = "draft" | "counting" | "completed";

export type DailyCountItem = {
  id: string;
  item_id: string;
  unit: string;
  opening_qty: number;
  received_qty: number | null;
  sold_qty: number;
  rnd_qty: number | null;
  waste_qty: number | null;
  counted_qty: number | null;
  variance_note: string | null;
  item: { name: string; brand: string | null; type: string; unit: string } | null;
};

const TYPE_LABEL: Record<string, string> = {
  ingredient: "Ingredient",
  prep_item: "Prep item",
};

type RowState = DailyCountItem & {
  received_text: string;
  rnd_text: string;
  waste_text: string;
  counted_text: string;
  note_text: string;
};

function numOrNull(text: string) {
  if (text.trim() === "") return null;
  const value = parseDecimal(text);
  return Number.isFinite(value) ? value : null;
}

function toRowState(item: DailyCountItem): RowState {
  return {
    ...item,
    received_text: item.received_qty == null ? "" : String(item.received_qty),
    rnd_text: item.rnd_qty == null ? "" : String(item.rnd_qty),
    waste_text: item.waste_qty == null ? "" : String(item.waste_qty),
    counted_text: item.counted_qty == null ? "" : String(item.counted_qty),
    note_text: item.variance_note ?? "",
  };
}

function lineOf(row: RowState) {
  return {
    opening_qty: Number(row.opening_qty),
    received_qty: numOrNull(row.received_text),
    sold_qty: Number(row.sold_qty),
    rnd_qty: numOrNull(row.rnd_text),
    waste_qty: numOrNull(row.waste_text),
  };
}

function toPayload(id: string, note: string, rows: RowState[]) {
  return {
    id,
    note: note.trim() || undefined,
    items: rows.map((row) => ({
      item_id: row.item_id,
      received_qty: numOrNull(row.received_text),
      rnd_qty: numOrNull(row.rnd_text),
      waste_qty: numOrNull(row.waste_text),
      counted_qty: numOrNull(row.counted_text),
      variance_note: row.note_text.trim() || null,
    })),
  };
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function VarianceValue({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const rounded = Number(value.toFixed(4));
  return (
    <span
      className={cn(
        "font-medium",
        rounded > 0
          ? "text-green-600 dark:text-green-400"
          : rounded < 0
            ? "text-destructive"
            : "text-muted-foreground",
      )}
    >
      {rounded > 0 ? "+" : ""}
      {formatNum(rounded)}
    </span>
  );
}

export function DailyCountWorkspace({
  count,
  items,
  canEdit,
  viewOnly = false,
}: {
  count: { id: string; status: CountStatus; count_date: string; note: string | null };
  items: DailyCountItem[];
  canEdit: boolean;
  viewOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refreshing, startRefresh] = useTransition();
  const [note, setNote] = useState(count.note ?? "");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<RowState[]>(() => items.map(toRowState));
  const [addOpen, setAddOpen] = useState(false);

  const isCompleted = count.status === "completed";
  const readOnly = isCompleted || viewOnly;
  const canInput = canEdit && count.status === "counting" && !readOnly;

  const countedRows = rows.filter((row) => row.counted_text.trim() !== "").length;
  const visibleRows = rows.filter((row) =>
    (row.item?.name ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  const totals = useMemo(() => {
    let positive = 0;
    let negative = 0;
    for (const row of rows) {
      const variance = varianceOf(lineOf(row), numOrNull(row.counted_text));
      if (variance == null) continue;
      const rounded = Number(variance.toFixed(4));
      if (rounded > 0) positive += 1;
      if (rounded < 0) negative += 1;
    }
    return { positive, negative };
  }, [rows]);

  function updateRow(itemId: string, patch: Partial<RowState>) {
    setRows((prev) => prev.map((row) => (row.item_id === itemId ? { ...row, ...patch } : row)));
  }

  function handleStart() {
    startTransition(async () => {
      const res = await startDailyStockCount(count.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Counting started");
      router.refresh();
    });
  }

  function handleSave() {
    startTransition(async () => {
      const res = await saveDailyStockCountDraft(toPayload(count.id, note, rows));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Draft saved");
      router.refresh();
    });
  }

  function handleRefreshSold() {
    startRefresh(async () => {
      const res = await refreshDailySoldQty(count.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRows((prev) =>
        prev.map((row) => ({
          ...row,
          sold_qty: res.sold[row.item_id] ?? row.sold_qty,
          opening_qty: res.opening[row.item_id] ?? row.opening_qty,
        })),
      );
      toast.success("Sold and opening refreshed from sales");
    });
  }

  function handleFinish() {
    if (rows.some((row) => row.counted_text.trim() === "")) {
      toast.error("Enter counted qty for every item before finishing");
      return;
    }

    const missingReason = rows.find((row) => {
      const variance = varianceOf(lineOf(row), numOrNull(row.counted_text));
      return variance != null && Number(variance.toFixed(4)) !== 0 && row.note_text.trim() === "";
    });
    if (missingReason) {
      toast.error(`Enter a variance reason for ${missingReason.item?.name ?? "the item with a variance"}`);
      return;
    }

    startTransition(async () => {
      const res = await finishDailyStockCount(toPayload(count.id, note, rows));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Daily count finished — on hand updated");
      router.refresh();
    });
  }

  function handleItemsAdded(added: AddedDailyCountItem[]) {
    setRows((prev) => [...prev, ...added.map(toRowState)]);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        {canInput && (
          <Button type="button" variant="outline" onClick={handleRefreshSold} disabled={refreshing}>
            <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
            {refreshing ? "Refreshing..." : "Refresh sold"}
          </Button>
        )}
        {canEdit && !readOnly && (
          <Button type="button" variant="outline" onClick={() => setAddOpen(true)} disabled={pending}>
            <Plus className="size-4" /> Add items
          </Button>
        )}
        {canEdit && count.status === "draft" && (
          <Button type="button" onClick={handleStart} disabled={pending}>
            <Play className="size-4" /> {pending ? "Starting..." : "Start counting"}
          </Button>
        )}
        {canInput && (
          <>
            <Button type="button" variant="outline" onClick={handleSave} disabled={pending}>
              <Save className="size-4" /> {pending ? "Saving..." : "Save draft"}
            </Button>
            <Button type="button" onClick={handleFinish} disabled={pending}>
              <Check className="size-4" /> {pending ? "Finishing..." : "Finish counting"}
            </Button>
          </>
        )}
      </div>

      {canEdit && !readOnly && (
        <AddDailyItemsDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          countId={count.id}
          existingItemIds={rows.map((row) => row.item_id)}
          onAdded={handleItemsAdded}
        />
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Progress" value={`${countedRows}/${rows.length} items`} />
        <StatCard label="Positive variance" value={`${totals.positive} items`} />
        <StatCard label="Negative variance" value={`${totals.negative} items`} />
      </div>

      {!readOnly && count.status === "draft" && (
        <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          Start counting to unlock the quantity inputs.
        </div>
      )}

      <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
        Expected closing = Opening + Received − Sold − R&amp;D − Waste. Variance = Counted −
        Expected closing, so a negative variance is unexplained shrinkage. Opening is the
        item&rsquo;s on hand when this count was created, with that day&rsquo;s sales added back.
      </div>

      {(canInput || note.trim() !== "") && (
        <div className="space-y-2">
          <label htmlFor="daily-global-note" className="text-sm font-medium">
            Global note
          </label>
          <Textarea
            id="daily-global-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={!canInput}
            maxLength={500}
            rows={2}
          />
        </div>
      )}

      <div className="flex justify-end">
        <Input
          placeholder="Search items..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full sm:w-56"
        />
      </div>

      <div className="table-outer overflow-x-auto rounded-lg border">
        <Table className="w-auto min-w-full table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[220px]">Item</TableHead>
              <TableHead className="w-[120px] text-right">Opening</TableHead>
              <TableHead className="w-[170px]">Received</TableHead>
              <TableHead className="w-[120px] text-right">Sold</TableHead>
              <TableHead className="w-[170px]">R&amp;D</TableHead>
              <TableHead className="w-[170px]">Waste</TableHead>
              <TableHead className="w-[140px] text-right">Expected closing</TableHead>
              <TableHead className="w-[170px]">Counted qty</TableHead>
              <TableHead className="w-[120px] text-right">Variance</TableHead>
              <TableHead className="w-[240px]">Variance reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                  No matching items.
                </TableCell>
              </TableRow>
            )}
            {visibleRows.map((row) => {
              const line = lineOf(row);
              const expected = expectedClosing(line);
              const counted = numOrNull(row.counted_text);
              const variance = varianceOf(line, counted);
              const needsReason =
                variance != null && Number(variance.toFixed(4)) !== 0 && row.note_text.trim() === "";

              return (
                <TableRow key={row.id}>
                  <TableCell className="font-medium truncate">
                    {row.item?.name ?? "Deleted item"}
                    <span className="block text-xs font-normal text-muted-foreground truncate">
                      {TYPE_LABEL[row.item?.type ?? ""] ?? row.item?.type} · {row.unit}
                    </span>
                  </TableCell>

                  <TableCell className="text-right tabular-nums">
                    {formatNum(Number(row.opening_qty))}
                  </TableCell>

                  <TableCell>
                    <QuantityCalculatorInput
                      min="0"
                      step="any"
                      value={row.received_text}
                      onValueChange={(value) => updateRow(row.item_id, { received_text: value })}
                      disabled={!canInput}
                      className="text-right"
                    />
                  </TableCell>

                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatNum(Number(row.sold_qty))}
                  </TableCell>

                  <TableCell>
                    <QuantityCalculatorInput
                      min="0"
                      step="any"
                      value={row.rnd_text}
                      onValueChange={(value) => updateRow(row.item_id, { rnd_text: value })}
                      disabled={!canInput}
                      className="text-right"
                    />
                  </TableCell>

                  <TableCell>
                    <QuantityCalculatorInput
                      min="0"
                      step="any"
                      value={row.waste_text}
                      onValueChange={(value) => updateRow(row.item_id, { waste_text: value })}
                      disabled={!canInput}
                      className="text-right"
                    />
                  </TableCell>

                  <TableCell className="text-right tabular-nums">
                    {formatNum(Number(expected.toFixed(4)))}
                  </TableCell>

                  <TableCell>
                    <QuantityCalculatorInput
                      min="0"
                      step="any"
                      value={row.counted_text}
                      onValueChange={(value) => updateRow(row.item_id, { counted_text: value })}
                      disabled={!canInput}
                      className="text-right"
                    />
                  </TableCell>

                  <TableCell className="text-right tabular-nums">
                    <VarianceValue value={variance} />
                  </TableCell>

                  <TableCell>
                    <Textarea
                      value={row.note_text}
                      onChange={(e) => updateRow(row.item_id, { note_text: e.target.value })}
                      disabled={!canInput}
                      maxLength={300}
                      rows={1}
                      className={cn("min-h-9 resize-none", needsReason && canInput && "border-destructive")}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function AddDailyItemsDialog({
  open,
  onOpenChange,
  countId,
  existingItemIds,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  countId: string;
  existingItemIds: string[];
  onAdded: (items: AddedDailyCountItem[]) => void;
}) {
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();
  const [options, setOptions] = useState<DailyCountItemOption[] | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  // Item options are fetched lazily the first time the dialog is opened.
  useEffect(() => {
    if (!open || options != null) return;
    startLoad(async () => {
      const res = await getDailyCountOptions();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setOptions(res.items);
    });
  }, [open, options]);

  function close() {
    setQuery("");
    setSelected(new Set());
    onOpenChange(false);
  }

  const alreadyIn = new Set(existingItemIds);
  const q = query.trim().toLowerCase();
  const filtered = (options ?? [])
    .filter((item) => !alreadyIn.has(item.id))
    .filter((item) => !q || item.name.toLowerCase().includes(q));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    if (selected.size === 0) {
      toast.error("Select at least one item to add");
      return;
    }
    startSave(async () => {
      const res = await addDailyStockCountItems({
        id: countId,
        items: [...selected].map((item_id) => ({ item_id })),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.items.length} item${res.items.length !== 1 ? "s" : ""} added to this count`);
      onAdded(res.items);
      close();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add items to this count</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search items..."
              className="pl-9"
            />
          </div>

          <div className="max-h-80 overflow-y-auto rounded-lg border">
            {loading && options == null ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Loading items...</p>
            ) : filtered.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                No items available to add.
              </p>
            ) : (
              filtered.map((item) => (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted/50"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => toggle(item.id)}
                    className="size-4 rounded border-border"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {item.name}
                    {item.brand && (
                      <span className="block text-xs font-normal text-muted-foreground truncate">
                        {item.brand}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {TYPE_LABEL[item.type] ?? item.type} · {item.unit}
                  </span>
                </label>
              ))
            )}
          </div>

          <p className="text-sm text-muted-foreground">{selected.size} selected</p>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={saving || selected.size === 0}>
            {saving ? "Adding..." : "Add items"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
