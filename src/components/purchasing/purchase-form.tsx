"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { DeletedItemBadge } from "@/components/ui/deleted-item-badge";
import { compatibleUnits, formatNum, parseDecimal } from "@/lib/units";
import { formatId, formatDate } from "@/lib/format";
import { createPurchase } from "@/app/actions/purchasing";

type Ingredient = { id: string; name: string; unit: string };

type ApprovedRequest = {
  id: string;
  note: string | null;
  created_at: string;
  reviewed_at: string | null;
  purchaseCount: number;
  items: {
    item_id: string;
    item_name: string | null;
    item_deleted: boolean;
    qty: number;
    unit: string;
    purchased_qty: number;
    purchased_unit: string;
  }[];
};

type PurchaseRow = {
  key: string;
  from_pr_id: string | null;        // which PR this row came from
  item_id: string | null;
  qty_requested: string | null;
  requested_unit: string | null;
  already_purchased: number | null;  // already fulfilled from prior purchases on same PR
  already_purchased_unit: string | null;
  qty_purchased: string;
  unit: string | null;
  cost: string;
  cost_mode: "per_unit" | "total";
  row_note: string;
};

function newRow(): PurchaseRow {
  return {
    key: crypto.randomUUID(),
    from_pr_id: null,
    item_id: null,
    qty_requested: null,
    requested_unit: null,
    already_purchased: null,
    already_purchased_unit: null,
    qty_purchased: "",
    unit: null,
    cost: "",
    cost_mode: "per_unit",
    row_note: "",
  };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function PurchaseForm({
  ingredients,
  approvedRequests,
}: {
  ingredients: Ingredient[];
  approvedRequests: ApprovedRequest[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [prIds, setPrIds] = useState<string[]>([]);
  const [prOpen, setPrOpen] = useState(false);
  const [expandedPrs, setExpandedPrs] = useState<Set<string>>(new Set());
  const [transactionDate, setTransactionDate] = useState(today());
  const [rows, setRows] = useState<PurchaseRow[]>([newRow()]);

  function handlePrToggle(requestId: string) {
    const pr = approvedRequests.find((r) => r.id === requestId);
    if (!pr) return;

    if (prIds.includes(requestId)) {
      // Deselect — remove rows from this PR
      setPrIds((prev) => prev.filter((id) => id !== requestId));
      setRows((prev) => {
        const remaining = prev.filter((r) => r.from_pr_id !== requestId);
        return remaining.length > 0 ? remaining : [newRow()];
      });
    } else {
      // Select — append rows from this PR
      setPrIds((prev) => [...prev, requestId]);
      const activeItems = pr.items.filter((it) => !it.item_deleted);
      if (activeItems.length === 0) {
        toast.error("All items in this request have been deleted");
        return;
      }
      if (activeItems.length < pr.items.length) {
        toast.warning(`${pr.items.length - activeItems.length} deleted item(s) skipped`);
      }
      const newRows = activeItems.map((it) => ({
        ...newRow(),
        from_pr_id: requestId,
        item_id: it.item_id,
        qty_requested: String(it.qty),
        requested_unit: it.unit,
        unit: it.unit,
        already_purchased: it.purchased_qty > 0 ? it.purchased_qty : null,
        already_purchased_unit: it.purchased_qty > 0 ? it.purchased_unit : null,
      }));
      setRows((prev) => {
        const isOnlyEmptyRow = prev.length === 1 && !prev[0].item_id && !prev[0].qty_purchased;
        return isOnlyEmptyRow ? newRows : [...prev, ...newRows];
      });
    }
  }

  function clearAllPrs() {
    setPrIds([]);
    setRows([newRow()]);
  }

  function addRow() { setRows((p) => [...p, newRow()]); }
  function removeRow(key: string) { setRows((p) => p.filter((r) => r.key !== key)); }
  function updateRow(key: string, patch: Partial<PurchaseRow>) {
    setRows((p) => p.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function handleItemSelect(key: string, itemId: string) {
    const item = ingredients.find((i) => i.id === itemId);
    updateRow(key, { item_id: itemId, unit: item?.unit ?? null });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const validRows = rows.filter((r) => r.item_id && r.qty_purchased && r.unit);
    if (!validRows.length) { toast.error("Add at least one item with a purchased quantity"); return; }
    const missingCost = validRows.find((r) => !r.cost);
    if (missingCost) { toast.error("Cost is required for all items"); return; }

    const payload = {
      purchase_request_ids: prIds.length > 0 ? prIds : undefined,
      transaction_date: transactionDate,
      items: validRows.map((r) => {
        const qty = parseDecimal(r.qty_purchased);
        const costVal = r.cost ? parseDecimal(r.cost) : null;
        return {
          item_id: r.item_id!,
          qty_requested: r.qty_requested ? parseDecimal(r.qty_requested) : null,
          requested_unit: r.requested_unit ?? null,
          qty_purchased: qty,
          unit: r.unit!,
          cost_per_unit: costVal != null && r.cost_mode === "per_unit" ? costVal : null,
          cost_total: costVal != null && r.cost_mode === "total" ? costVal : null,
          row_note: r.row_note.trim() || null,
        };
      }),
    };

    start(async () => {
      const res = await createPurchase(payload);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Purchase saved — stock updated");
      router.push(`/purchasing/purchases/${res.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">

      {/* PR picker + Transaction date */}
      <div className="max-w-2xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>From purchase request (optional)</Label>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between font-normal"
              onClick={() => setPrOpen(true)}
            >
              <span className="text-muted-foreground truncate">
                {prIds.length === 0
                  ? "Select approved request"
                  : `${prIds.length} request${prIds.length > 1 ? "s" : ""} selected`}
              </span>
              <ChevronsUpDown className="size-4 opacity-50 shrink-0 ml-1" />
            </Button>

            {/* Selected PR chips */}
            {prIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {prIds.map((id) => {
                  const pr = approvedRequests.find((r) => r.id === id);
                  return (
                    <Badge key={id} variant="secondary" className="gap-1 pl-2 pr-1 h-6">
                      <span className="font-mono text-xs">{formatId(id)}</span>
                      {pr && <span className="text-muted-foreground">· {pr.items.length} items</span>}
                      <button
                        type="button"
                        onClick={() => handlePrToggle(id)}
                        className="ml-0.5 rounded hover:bg-muted-foreground/20 p-0.5"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  );
                })}
                <button
                  type="button"
                  onClick={clearAllPrs}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* PR selection modal */}
            <Dialog open={prOpen} onOpenChange={setPrOpen}>
              <DialogContent className="sm:max-w-none w-[min(1100px,calc(100vw-2rem))] max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
                <div className="px-6 pt-5 pb-4 border-b shrink-0">
                  <DialogTitle>Select purchase request</DialogTitle>
                </div>
                {approvedRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-6">No approved requests available.</p>
                ) : (
                  <div className="overflow-y-auto flex-1 min-h-0">
                    <table className="w-full text-sm border-collapse">
                      <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur-sm">
                        <tr className="border-b">
                          <th className="w-10 px-4 py-2.5 text-left text-xs font-normal text-muted-foreground" />
                          <th className="w-32 px-3 py-2.5 text-left text-xs font-normal text-muted-foreground">No PR</th>
                          <th className="w-28 px-3 py-2.5 text-left text-xs font-normal text-muted-foreground">Request date</th>
                          <th className="w-28 px-3 py-2.5 text-left text-xs font-normal text-muted-foreground">Approved date</th>
                          <th className="px-3 py-2.5 text-left text-xs font-normal text-muted-foreground">Item</th>
                          <th className="w-32 px-3 py-2.5 text-right text-xs font-normal text-muted-foreground">Requested</th>
                          <th className="w-48 px-3 py-2.5 text-right text-xs font-normal text-muted-foreground">Purchased / Left</th>
                        </tr>
                      </thead>
                      <tbody>
                        {approvedRequests.map((pr) => {
                          const selected = prIds.includes(pr.id);
                          const expanded = expandedPrs.has(pr.id);
                          const MAX_ITEMS = 5;
                          const visibleItems = expanded ? pr.items : pr.items.slice(0, MAX_ITEMS);
                          const hasMore = pr.items.length > MAX_ITEMS;
                          const isPartial = pr.purchaseCount > 0;
                          return (
                            <tr
                              key={pr.id}
                              onClick={() => handlePrToggle(pr.id)}
                              className={cn(
                                "border-b last:border-0 cursor-pointer transition-colors align-top",
                                selected ? "bg-primary/5 hover:bg-primary/8" : "hover:bg-muted/40"
                              )}
                            >
                              {/* Checkbox */}
                              <td className="px-4 py-3">
                                <span className={cn(
                                  "mt-0.5 size-4 rounded border flex items-center justify-center shrink-0",
                                  selected ? "bg-primary border-primary" : "border-input"
                                )}>
                                  {selected && <Check className="size-3 text-primary-foreground" />}
                                </span>
                              </td>
                              {/* No PR + partial badge */}
                              <td className="px-3 py-3">
                                <span className="font-medium tabular-nums block">{formatId(pr.id)}</span>
                                {isPartial && (
                                  <span className="text-xs text-amber-600 dark:text-amber-400 font-normal">partial</span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-muted-foreground">{formatDate(pr.created_at)}</td>
                              <td className="px-3 py-3 text-muted-foreground">{pr.reviewed_at ? formatDate(pr.reviewed_at) : "—"}</td>
                              {/* Items — spans item name, requested, purchased columns via sub-rows */}
                              <td colSpan={3} className="px-0 py-0">
                                <table className="w-full">
                                  <tbody>
                                    {visibleItems.map((it, i) => {
                                      const fullyDone = it.purchased_qty >= it.qty;
                                      const remaining = Math.max(0, it.qty - it.purchased_qty);
                                      return (
                                        <tr key={i} className={i < visibleItems.length - 1 ? "border-b border-dashed border-muted-foreground/15" : ""}>
                                          <td className="px-3 py-1.5">
                                            <span className={cn(
                                              "flex items-center gap-0 min-w-0",
                                              fullyDone ? "text-muted-foreground line-through" : "text-foreground"
                                            )}>
                                              <span className="truncate">{it.item_name ?? "—"}</span>
                                              {it.item_deleted && <DeletedItemBadge />}
                                            </span>
                                          </td>
                                          <td className="w-32 px-3 py-1.5 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                                            {formatNum(it.qty)} {it.unit}
                                          </td>
                                          <td className="w-48 px-3 py-1.5 text-right tabular-nums whitespace-nowrap">
                                            {it.purchased_qty > 0 ? (
                                              <span className={cn(
                                                "text-xs",
                                                fullyDone ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400"
                                              )}>
                                                {fullyDone
                                                  ? `✓ ${formatNum(it.purchased_qty)} ${it.purchased_unit}`
                                                  : `${formatNum(it.purchased_qty)} ${it.purchased_unit} · ${formatNum(remaining)} ${it.unit} left`}
                                              </span>
                                            ) : (
                                              <span className="text-muted-foreground/40">—</span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                    {hasMore && (
                                      <tr>
                                        <td colSpan={3} className="px-3 py-1.5">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setExpandedPrs((prev) => {
                                                const next = new Set(prev);
                                                if (expanded) next.delete(pr.id); else next.add(pr.id);
                                                return next;
                                              });
                                            }}
                                            className="text-xs text-muted-foreground hover:text-foreground underline"
                                          >
                                            {expanded ? "Show less" : `+${pr.items.length - MAX_ITEMS} more`}
                                          </button>
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="flex justify-end gap-2 px-6 py-4 border-t shrink-0">
                  <Button type="button" variant="ghost" onClick={() => setPrOpen(false)}>Cancel</Button>
                  <Button type="button" onClick={() => setPrOpen(false)}>
                    {prIds.length > 0 ? `Confirm (${prIds.length} selected)` : "Done"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transaction-date">Transaction date</Label>
            <Input
              id="transaction-date"
              type="date"
              required
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Item rows — table */}
      <div className="space-y-3">
        <Label>Items purchased</Label>

        <div className="border table-outer rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Ingredient</TableHead>
                <TableHead className="w-32 text-right">Requested</TableHead>
                <TableHead className="w-32 text-right">Prev. purchased</TableHead>
                <TableHead className="w-28 text-center">Qty purchased</TableHead>
                <TableHead className="w-24 text-center">Unit</TableHead>
                <TableHead className="w-40 text-center">Cost</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => (
                <PurchaseRowField
                  key={row.key}
                  row={row}
                  index={idx}
                  ingredients={ingredients}
                  onItemSelect={(id) => handleItemSelect(row.key, id)}
                  onQtyPurchasedChange={(v) => updateRow(row.key, { qty_purchased: v })}
                  onUnitChange={(u) => updateRow(row.key, { unit: u })}
                  onCostChange={(v) => updateRow(row.key, { cost: v })}
                  onCostModeToggle={() =>
                    updateRow(row.key, { cost_mode: row.cost_mode === "per_unit" ? "total" : "per_unit" })
                  }
                  onRowNoteChange={(v) => updateRow(row.key, { row_note: v })}
                  onRemove={rows.length > 1 ? () => removeRow(row.key) : undefined}
                />
              ))}
            </TableBody>
          </Table>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="size-4" /> Add item
        </Button>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save purchase"}
        </Button>
      </div>
    </form>
  );
}

function PurchaseRowField({
  row, index, ingredients,
  onItemSelect, onQtyPurchasedChange, onUnitChange,
  onCostChange, onCostModeToggle, onRowNoteChange, onRemove,
}: {
  row: PurchaseRow;
  index: number;
  ingredients: Ingredient[];
  onItemSelect: (id: string) => void;
  onQtyPurchasedChange: (v: string) => void;
  onUnitChange: (u: string) => void;
  onCostChange: (v: string) => void;
  onCostModeToggle: () => void;
  onRowNoteChange: (v: string) => void;
  onRemove?: () => void;
}) {
  const [itemOpen, setItemOpen] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);

  const selectedItem = ingredients.find((i) => i.id === row.item_id) ?? null;
  const units = selectedItem ? compatibleUnits(selectedItem.unit) : [];

  const showRowNote =
    row.qty_requested !== null &&
    row.qty_purchased !== "" &&
    (parseDecimal(row.qty_purchased) !== parseDecimal(row.qty_requested) || row.unit !== row.requested_unit);

  return (
    <>
      <TableRow className={showRowNote ? "border-b-0" : ""}>
        {/* # */}
        <TableCell className="text-muted-foreground text-right">
          {index + 1}.
        </TableCell>

        {/* Ingredient picker */}
        <TableCell>
          <Popover open={itemOpen} onOpenChange={setItemOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" role="combobox"
                className="w-full justify-between font-normal">
                <span className={cn("truncate", !selectedItem && "text-muted-foreground")}>
                  {selectedItem ? selectedItem.name : "Select ingredient"}
                </span>
                <ChevronsUpDown className="size-4 opacity-50 shrink-0 ml-1" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <Command>
                <CommandInput placeholder="Search ingredients..." />
                <CommandList>
                  <CommandEmpty>No ingredients found.</CommandEmpty>
                  <CommandGroup>
                    {ingredients.map((item) => (
                      <CommandItem key={item.id} value={item.name}
                        onSelect={() => { onItemSelect(item.id); setItemOpen(false); }}>
                        <Check className={cn("size-4", row.item_id === item.id ? "opacity-100" : "opacity-0")} />
                        {item.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </TableCell>

        {/* Requested qty */}
        <TableCell className="text-right tabular-nums text-muted-foreground">
          {row.qty_requested
            ? `${formatNum(Number(row.qty_requested))} ${row.requested_unit ?? ""}`
            : "—"}
        </TableCell>

        {/* Already purchased */}
        <TableCell className="text-right tabular-nums">
          {row.already_purchased != null ? (
            <span className="text-amber-600 dark:text-amber-400">
              {formatNum(row.already_purchased)} {row.already_purchased_unit}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>

        {/* Qty purchased */}
        <TableCell>
          <DecimalInput
            min="0" step="any"
            value={row.qty_purchased}
            onValueChange={(v) => onQtyPurchasedChange(v)}
            className="w-full"
          />
        </TableCell>

        {/* Unit picker */}
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
                      <CommandItem key={u} value={u} onSelect={() => { onUnitChange(u); setUnitOpen(false); }}>
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

        {/* Cost input + mode toggle */}
        <TableCell>
          <div className="flex items-center gap-1">
            <DecimalInput
              min="0" step="any"
              placeholder="0"
              value={row.cost}
              onValueChange={(v) => onCostChange(v)}
              className="flex-1 min-w-0"
            />
            <button
              type="button"
              onClick={onCostModeToggle}
              title={row.cost_mode === "per_unit" ? "Per unit — click to switch to total" : "Total — click to switch to per unit"}
              className="text-xs text-muted-foreground hover:text-foreground whitespace-nowrap shrink-0 border rounded px-1.5 py-1 h-9"
            >
              {row.cost_mode === "per_unit" ? "/unit" : "total"}
            </button>
          </div>
        </TableCell>

        {/* Remove */}
        <TableCell className="px-2">
          <Button type="button" variant="ghost" size="icon"
            onClick={onRemove} disabled={!onRemove}
            className="text-muted-foreground">
            <Trash2 className="size-4" />
          </Button>
        </TableCell>
      </TableRow>

      {/* Row note — spans all columns, shown when qty differs from requested */}
      {showRowNote && (
        <TableRow>
          <TableCell />
          <TableCell colSpan={6} className="pb-2 pt-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">Note (qty differs):</span>
              <Input
                value={row.row_note}
                onChange={(e) => onRowNoteChange(e.target.value)}
                className="h-7 text-sm flex-1"
                maxLength={300}
              />
            </div>
          </TableCell>
          <TableCell />
        </TableRow>
      )}
    </>
  );
}
