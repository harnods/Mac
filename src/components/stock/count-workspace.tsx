"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Play, Printer, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { convert, convertToItemUnit, formatNum, parseDecimal, unitOptionsForItem } from "@/lib/units";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { QuantityCalculatorInput } from "@/components/stock/quantity-calculator-input";
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
import { Qty } from "@/components/ui/qty";
import { finishStockCount, saveStockCountDraft, startStockCount } from "@/app/actions/stock";

type CountStatus = "draft" | "counting" | "completed";

type CountItem = {
  id: string;
  item_id: string;
  qty_system: number;
  qty_counted: number | null;
  unit: string;
  unopened_qty: number | null;
  unopened_unit: string | null;
  in_use_qty: number | null;
  in_use_unit: string | null;
  note: string | null;
  item: {
    name: string;
    unit: string;
    purchase_unit: string | null;
    purchase_unit_qty: number | null;
    item_unit_conversions: { from_unit: string; factor: number; to_unit: string }[];
  } | null;
};

type CountWorkspaceProps = {
  count: {
    id: string;
    status: CountStatus;
    note: string | null;
    started_at: string | null;
    completed_at: string | null;
  };
  items: CountItem[];
  canEdit: boolean;
};

type RowState = CountItem & {
  qty_counted_text: string;
  unopened_qty_text: string;
  unopened_unit: string;
  in_use_qty_text: string;
  in_use_unit: string;
  note_text: string;
};

function toPayload(id: string, note: string, rows: RowState[]) {
  return {
    id,
    note: note.trim() || undefined,
    items: rows.map((row) => ({
      item_id: row.item_id,
      qty_counted:
        row.qty_counted_text.trim() === "" ? null : parseDecimal(row.qty_counted_text),
      unit: row.unit,
      unopened_qty:
        row.unopened_qty_text.trim() === "" ? null : parseDecimal(row.unopened_qty_text),
      unopened_unit: row.unopened_unit,
      in_use_qty:
        row.in_use_qty_text.trim() === "" ? null : parseDecimal(row.in_use_qty_text),
      in_use_unit: row.in_use_unit,
      note: row.note_text.trim() || undefined,
    })),
  };
}

function baseUnit(row: RowState) {
  return row.item?.unit ?? row.unit;
}

function systemQtyForSelectedUnit(row: RowState) {
  return convert(Number(row.qty_system), baseUnit(row), row.unit) ?? Number(row.qty_system);
}

function unitOptions(row: RowState) {
  return unitOptionsForItem({
    unit: baseUnit(row),
    purchase_unit: row.item?.purchase_unit,
    item_unit_conversions: row.item?.item_unit_conversions,
  });
}

function toBaseQty(row: RowState, rawQty: string, unit: string) {
  if (rawQty.trim() === "") return 0;
  const qty = parseDecimal(rawQty);
  if (!Number.isFinite(qty)) return 0;
  return convertToItemUnit(qty, unit, {
    unit: baseUnit(row),
    purchase_unit: row.item?.purchase_unit,
    purchase_unit_qty: row.item?.purchase_unit_qty,
    item_unit_conversions: row.item?.item_unit_conversions,
  });
}

function fromBaseQty(row: RowState, qty: number, unit: string) {
  if (unit === baseUnit(row)) return qty;
  const converted = convert(qty, baseUnit(row), unit);
  if (converted != null) return converted;
  if (row.item?.purchase_unit === unit && row.item.purchase_unit_qty) {
    return qty / Number(row.item.purchase_unit_qty);
  }
  return qty;
}

function cleanQty(value: number) {
  return Number.isFinite(value) ? String(Number(value.toFixed(4))) : "";
}

function updateSplitRow(row: RowState, patch: Partial<RowState>) {
  const next = { ...row, ...patch };
  const hasSplit = next.unopened_qty_text.trim() !== "" || next.in_use_qty_text.trim() !== "";
  if (!hasSplit) return { ...next, qty_counted_text: "" };

  const baseTotal =
    toBaseQty(next, next.unopened_qty_text, next.unopened_unit) +
    toBaseQty(next, next.in_use_qty_text, next.in_use_unit);
  return {
    ...next,
    qty_counted_text: cleanQty(fromBaseQty(next, baseTotal, next.unit)),
  };
}

export function CountWorkspace({ count, items, canEdit }: CountWorkspaceProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState(count.note ?? "");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<RowState[]>(
    items.map((item) => {
      const hasStoredSplit = item.unopened_qty != null || item.in_use_qty != null;
      return {
        ...item,
        qty_counted_text: item.qty_counted == null ? "" : String(item.qty_counted),
        unopened_qty_text:
          item.unopened_qty == null
            ? hasStoredSplit || item.qty_counted == null
              ? ""
              : String(item.qty_counted)
            : String(item.unopened_qty),
        unopened_unit:
          item.unopened_unit ??
          (hasStoredSplit || item.qty_counted == null ? item.item?.purchase_unit : item.unit) ??
          item.unit,
        in_use_qty_text: item.in_use_qty == null ? "" : String(item.in_use_qty),
        in_use_unit: item.in_use_unit ?? item.item?.unit ?? item.unit,
        note_text: item.note ?? "",
      };
    })
  );

  const isCompleted = count.status === "completed";
  const isCounting = count.status === "counting";
  const canInput = canEdit && isCounting && !isCompleted;
  const missingCount = rows.some((row) => row.qty_counted_text.trim() === "");
  const countedRows = rows.filter((row) => row.qty_counted_text.trim() !== "").length;
  const visibleRows = rows.filter((row) => (row.item?.name ?? "").toLowerCase().includes(q.toLowerCase()));

  const totals = useMemo(() => {
    let positive = 0;
    let negative = 0;
    for (const row of rows) {
      if (row.qty_counted_text.trim() === "") continue;
      const counted = parseDecimal(row.qty_counted_text);
      if (!Number.isFinite(counted)) continue;
      const variance = counted - systemQtyForSelectedUnit(row);
      if (variance > 0) positive += 1;
      if (variance < 0) negative += 1;
    }
    return { positive, negative };
  }, [rows]);

  function updateRow(itemId: string, patch: Partial<RowState>) {
    setRows((prev) =>
      prev.map((row) => (row.item_id === itemId ? { ...row, ...patch } : row))
    );
  }

  function updateSplit(itemId: string, patch: Partial<RowState>) {
    setRows((prev) =>
      prev.map((row) => (row.item_id === itemId ? updateSplitRow(row, patch) : row))
    );
  }

  function handleStart() {
    startTransition(async () => {
      const res = await startStockCount(count.id);
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
      const res = await saveStockCountDraft(toPayload(count.id, note, rows));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Draft saved");
      router.refresh();
    });
  }

  function handleFinish() {
    if (missingCount) {
      toast.error("Enter counted qty for every item before finishing");
      return;
    }

    startTransition(async () => {
      const res = await finishStockCount(toPayload(count.id, note, rows));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Counting finished — on hand updated");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div>
            <span className="text-muted-foreground">Progress </span>
            <span className="font-medium">{countedRows}/{rows.length}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Positive variance </span>
            <span className="font-medium">{totals.positive}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Negative variance </span>
            <span className="font-medium">{totals.negative}</span>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" /> Print stock cards
          </Button>
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
      </div>

      {!isCompleted && !isCounting && (
        <div className="no-print rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          Print the stock cards first, then start counting to unlock quantity inputs and capture the start timestamp.
        </div>
      )}

      <div className="no-print space-y-2">
        <label htmlFor="global-note" className="text-sm font-medium">
          Global note
        </label>
        <Textarea
          id="global-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={!canInput}
          maxLength={500}
          rows={2}
        />
      </div>

      <div className="no-print flex justify-end">
        <Input
          placeholder="Search items..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full sm:w-56"
        />
      </div>

      <div className="no-print table-outer overflow-x-auto rounded-lg border">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">Item</TableHead>
              <TableHead className="min-w-[150px] text-right">System qty</TableHead>
              <TableHead className="min-w-[150px]">Counted qty</TableHead>
              <TableHead className="min-w-[150px]">In-use qty</TableHead>
              <TableHead className="min-w-[150px] text-right">Variance</TableHead>
              <TableHead className="min-w-[150px]">Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  No matching items.
                </TableCell>
              </TableRow>
            )}
            {visibleRows.map((row) => {
              const units = unitOptions(row);
              const systemQty = systemQtyForSelectedUnit(row);
              const counted =
                row.qty_counted_text.trim() === "" ? null : parseDecimal(row.qty_counted_text);
              const variance =
                counted != null && Number.isFinite(counted)
                  ? counted - systemQty
                  : null;

              return (
                <TableRow key={row.id}>
                  <TableCell className="min-w-56 font-medium truncate">
                    {row.item?.name ?? "Deleted item"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Qty value={systemQty} unit={row.unit} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <QuantityCalculatorInput
                        min="0"
                        step="any"
                        value={row.unopened_qty_text}
                        onValueChange={(value) =>
                          updateSplit(row.item_id, { unopened_qty_text: value })
                        }
                        disabled={!canInput}
                        className="text-right"
                      />
                      {canInput && units.length > 1 ? (
                        <Select
                          value={row.unopened_unit}
                          onValueChange={(unit) => updateSplit(row.item_id, { unopened_unit: unit })}
                        >
                          <SelectTrigger className="w-20 shrink-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {units.map((unit) => (
                              <SelectItem key={unit} value={unit}>
                                {unit}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="w-20 shrink-0 text-left text-sm text-muted-foreground">
                          {row.unopened_unit}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <QuantityCalculatorInput
                        min="0"
                        step="any"
                        value={row.in_use_qty_text}
                        onValueChange={(value) =>
                          updateSplit(row.item_id, { in_use_qty_text: value })
                        }
                        disabled={!canInput}
                        className="text-right"
                      />
                      {canInput && units.length > 1 ? (
                        <Select
                          value={row.in_use_unit}
                          onValueChange={(unit) => updateSplit(row.item_id, { in_use_unit: unit })}
                        >
                          <SelectTrigger className="w-20 shrink-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {units.map((unit) => (
                              <SelectItem key={unit} value={unit}>
                                {unit}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="w-20 shrink-0 text-left text-sm text-muted-foreground">
                          {row.in_use_unit}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {variance == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span
                        className={cn(
                          "font-medium",
                          variance > 0
                            ? "text-green-600 dark:text-green-400"
                            : variance < 0
                              ? "text-destructive"
                              : "text-muted-foreground"
                        )}
                      >
                        {variance > 0 ? "+" : ""}
                        {formatNum(variance)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Textarea
                      value={row.note_text}
                      onChange={(e) => updateRow(row.item_id, { note_text: e.target.value })}
                      disabled={!canInput}
                      maxLength={300}
                      rows={1}
                      className="min-h-9 resize-none"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="hidden print:block">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Stock Cards</h1>
          <p className="text-sm text-muted-foreground">
            {count.started_at ? `Started ${formatDateTime(count.started_at)}` : "Not started"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {rows.map((row) => (
            <div key={row.id} className="break-inside-avoid rounded-lg border p-4">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">{row.item?.name ?? "Deleted item"}</h2>
                  <p className="text-sm text-muted-foreground">Unit: {row.unit}</p>
                </div>
                <div className="text-right text-sm">
                  <div className="text-muted-foreground">System qty</div>
                  <div className="font-medium">{formatNum(systemQtyForSelectedUnit(row))} {row.unit}</div>
                </div>
              </div>
              <div className="space-y-5 text-sm">
                <div className="border-b pb-5">Counted qty:</div>
                <div className="border-b pb-5">In-use qty:</div>
                <div className="border-b pb-5">Counter:</div>
                <div className="border-b pb-5">Note:</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>
    </div>
  );
}
