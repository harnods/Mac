"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronsUpDown, CheckCircle2, AlertTriangle, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { convert, formatNum, compatibleUnits, parseDecimal } from "@/lib/units";
import { createPrepOrder } from "@/app/actions/prep-orders";
import type { RecipeForPrep } from "@/app/(app)/prep-orders/new/page";
import type { UnitCode } from "@/lib/supabase/types";

type PrepMode = "count" | "ingredient";

type IngredientRow = {
  item_id: string;
  item_name: string;
  recipe_unit: string;
  qty_per_batch: number;
  item_base_unit: string;
  on_hand: number;
  reserved: number;
};

type ComputedRow = IngredientRow & {
  needed: number | null;
  on_hand_in_recipe_unit: number;
  reserved_in_recipe_unit: number;
  available_in_recipe_unit: number;
  sufficient: boolean;
  // display
  displayUnit: string;
  compatUnits: string[];
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Convert a value from recipe_unit → displayUnit
function toDisplay(val: number, recipeUnit: string, displayUnit: string): number {
  if (recipeUnit === displayUnit) return val;
  return convert(val, recipeUnit as UnitCode, displayUnit as UnitCode) ?? val;
}

export function PrepOrderForm({ recipes }: { recipes: RecipeForPrep[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [prepDate, setPrepDate] = useState(todayIso());
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  // Mode
  const [prepMode, setPrepMode] = useState<PrepMode>("count");

  // Count mode
  const [batchCount, setBatchCount] = useState("");

  // Ingredient mode
  const [calcIngredientId, setCalcIngredientId] = useState<string | null>(null);
  const [calcIngredientOpen, setCalcIngredientOpen] = useState(false);
  const [calcQty, setCalcQty] = useState("");
  const [calcUnit, setCalcUnit] = useState<string | null>(null);
  const [calcUnitOpen, setCalcUnitOpen] = useState(false);

  // Per-row display units (item_id → displayUnit)
  const [rowDisplayUnits, setRowDisplayUnits] = useState<Record<string, string>>({});

  const [notes, setNotes] = useState("");

  const selectedRecipe = recipes.find((r) => r.id === selectedRecipeId) ?? null;

  const batches = parseDecimal(batchCount);
  const validBatches = !isNaN(batches) && batches > 0;

  // Build ingredient rows
  const ingredientRows: IngredientRow[] = selectedRecipe
    ? selectedRecipe.recipe_items
        .filter((ri) => ri.item !== null && ri.item.deleted_at === null)
        .map((ri) => ({
          item_id: ri.item_id,
          item_name: ri.item!.name,
          recipe_unit: ri.unit,
          qty_per_batch: ri.quantity,
          item_base_unit: ri.item!.unit,
          on_hand: Number(ri.item!.on_hand),
          reserved: Number(ri.item!.reserved),
        }))
    : [];

  const computedRows: ComputedRow[] = ingredientRows.map((row) => {
    const needed = validBatches ? row.qty_per_batch * batches : null;
    const toRecipeUnit = (val: number) => convert(val, row.item_base_unit, row.recipe_unit) ?? val;
    const on_hand_in_recipe_unit = toRecipeUnit(row.on_hand);
    const reserved_in_recipe_unit = toRecipeUnit(row.reserved);
    const available_in_recipe_unit = on_hand_in_recipe_unit - reserved_in_recipe_unit;
    const sufficient = needed !== null && available_in_recipe_unit >= needed;
    const compatUnits = compatibleUnits(row.recipe_unit as UnitCode);
    const displayUnit = rowDisplayUnits[row.item_id] ?? row.recipe_unit;
    return {
      ...row,
      needed,
      on_hand_in_recipe_unit,
      reserved_in_recipe_unit,
      available_in_recipe_unit,
      sufficient,
      displayUnit,
      compatUnits,
    };
  });

  const insufficientCount = validBatches ? computedRows.filter((r) => !r.sufficient).length : 0;

  // ── Ingredient-mode calculation ─────────────────────────────────────────────
  const calcIngredientRow = computedRows.find((r) => r.item_id === calcIngredientId) ?? null;
  const calcQtyNum = parseDecimal(calcQty);
  const validCalcQty = !isNaN(calcQtyNum) && calcQtyNum > 0;

  // Reset calc unit when ingredient changes
  useEffect(() => {
    if (calcIngredientRow) {
      setCalcUnit(calcIngredientRow.recipe_unit);
    } else {
      setCalcUnit(null);
    }
    setCalcQty("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calcIngredientId]);

  type IngredientLimit = { name: string; maxPreps: number };

  const ingredientCalc: {
    prepsFromSelected: number;
    maxPossible: number;
    limitingIngredient: IngredientLimit | null;
    otherNeeded: { name: string; qty: number; unit: string }[];
  } | null = (() => {
    if (!calcIngredientRow || !validCalcQty || !calcUnit || calcIngredientRow.qty_per_batch <= 0) return null;

    const enteredInRecipeUnit =
      convert(calcQtyNum, calcUnit as UnitCode, calcIngredientRow.recipe_unit as UnitCode) ?? calcQtyNum;
    const prepsFromSelected = enteredInRecipeUnit / calcIngredientRow.qty_per_batch;

    const limits: IngredientLimit[] = computedRows
      .filter((r) => r.item_id !== calcIngredientId)
      .map((r) => ({
        name: r.item_name,
        maxPreps: r.qty_per_batch > 0 ? r.available_in_recipe_unit / r.qty_per_batch : Infinity,
      }));

    const maxPossible = Math.max(0, Math.min(prepsFromSelected, ...limits.map((l) => l.maxPreps)));

    const limitingIngredient =
      maxPossible < Math.floor(prepsFromSelected) && limits.length > 0
        ? limits.reduce((a, b) => (a.maxPreps < b.maxPreps ? a : b), limits[0])
        : null;

    // How much of each OTHER ingredient is needed for maxPossible preps
    const otherNeeded = computedRows
      .filter((r) => r.item_id !== calcIngredientId)
      .map((r) => ({
        name: r.item_name,
        qty: r.qty_per_batch * maxPossible,
        unit: r.displayUnit,
      }));

    return { prepsFromSelected, maxPossible, limitingIngredient, otherNeeded };
  })();

  // Auto-fill batch count when ingredient calc changes
  useEffect(() => {
    if (prepMode === "ingredient" && ingredientCalc !== null) {
      setBatchCount(String(ingredientCalc.maxPossible));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredientCalc?.maxPossible, prepMode]);

  const yieldUnit = selectedRecipe?.unit ?? selectedRecipe?.product?.unit ?? "pcs";

  function resetRecipe() {
    setBatchCount("");
    setCalcIngredientId(null);
    setCalcQty("");
    setCalcUnit(null);
    setRowDisplayUnits({});
  }

  function setRowDisplayUnit(itemId: string, unit: string) {
    setRowDisplayUnits((prev) => ({ ...prev, [itemId]: unit }));
  }

  function handleSubmit() {
    if (!selectedRecipe || !validBatches) return;

    const payload = {
      recipe_id: selectedRecipe.id,
      product_id: selectedRecipe.product_id,
      batch_count: batches,
      target_qty: batches * (selectedRecipe.yield_qty ?? 1),
      unit: yieldUnit,
      prep_date: prepDate,
      notes: notes || undefined,
      items: ingredientRows.map((row) => ({
        item_id: row.item_id,
        qty_needed: row.qty_per_batch * batches,
        unit: row.recipe_unit,
      })),
    };

    start(async () => {
      const res = await createPrepOrder(payload);
      if (!res.ok) {
        toast.error(res.error);
      } else {
        if (insufficientCount > 0) {
          toast.warning(
            `Prep order created with ${insufficientCount} insufficient ingredient${insufficientCount > 1 ? "s" : ""}`
          );
        } else {
          toast.success("Prep order created");
        }
        router.push(`/prep-orders/${res.id}`);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="max-w-lg space-y-4">
        {/* Date + Recipe */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="prep-date">Date</Label>
            <Input
              id="prep-date"
              type="date"
              value={prepDate}
              onChange={(e) => setPrepDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Recipe</Label>
            <Popover open={recipeOpen} onOpenChange={setRecipeOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {selectedRecipe ? selectedRecipe.name : "Select recipe"}
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search recipe..." />
                  <CommandList>
                    <CommandEmpty>No recipes found.</CommandEmpty>
                    <CommandGroup>
                      {recipes.map((r) => (
                        <CommandItem
                          key={r.id}
                          value={r.name}
                          onSelect={() => {
                            setSelectedRecipeId(r.id);
                            resetRecipe();
                            setRecipeOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 size-4", selectedRecipeId === r.id ? "opacity-100" : "opacity-0")} />
                          <div>
                            <div className="text-sm">{r.name}</div>
                            {r.product && <div className="text-xs text-muted-foreground">{r.product.name}</div>}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Prep qty section */}
        {selectedRecipe && (
          <div className="space-y-3">
            {/* Mode radio */}
            <div className="flex gap-4">
              {(["count", "ingredient"] as PrepMode[]).map((mode) => (
                <label key={mode} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="prep-mode"
                    value={mode}
                    checked={prepMode === mode}
                    onChange={() => { setPrepMode(mode); resetRecipe(); }}
                    className="accent-primary"
                  />
                  <span className="text-sm font-medium">
                    {mode === "count" ? "Set prep count" : "From ingredient"}
                  </span>
                </label>
              ))}
            </div>

            {prepMode === "count" ? (
              <div className="space-y-1.5">
                <Label htmlFor="batch-count">Preps</Label>
                <div className="flex items-center gap-2">
                  <DecimalInput
                    id="batch-count"
                    min="1"
                    step="1"
                    value={batchCount}
                    onValueChange={(v) => setBatchCount(v)}
                    className="w-32"
                  />
                  {validBatches && (
                    <span className="text-sm text-muted-foreground">
                      → target {formatNum(batches * (selectedRecipe.yield_qty ?? 1))} {yieldUnit}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Ingredient picker */}
                  <div className="space-y-1.5">
                    <Label>Ingredient</Label>
                    <Popover open={calcIngredientOpen} onOpenChange={setCalcIngredientOpen}>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
                          <span className={cn(!calcIngredientId && "text-muted-foreground")}>
                            {calcIngredientRow?.item_name ?? "Select ingredient"}
                          </span>
                          <ChevronsUpDown className="size-4 opacity-50 shrink-0 ml-1" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search..." />
                          <CommandList>
                            <CommandEmpty>No ingredients.</CommandEmpty>
                            <CommandGroup>
                              {ingredientRows.map((r) => (
                                <CommandItem
                                  key={r.item_id}
                                  value={r.item_name}
                                  onSelect={() => { setCalcIngredientId(r.item_id); setCalcIngredientOpen(false); }}
                                >
                                  <Check className={cn("size-4", calcIngredientId === r.item_id ? "opacity-100" : "opacity-0")} />
                                  {r.item_name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Qty + unit */}
                  <div className="space-y-1.5">
                    <Label>Qty</Label>
                    <div className="flex items-center gap-2">
                      <DecimalInput
                        min="0"
                        step="any"
                        value={calcQty}
                        onValueChange={(v) => setCalcQty(v)}
                        disabled={!calcIngredientRow}
                        className="w-24"
                      />
                      {calcIngredientRow && (
                        <Popover open={calcUnitOpen} onOpenChange={setCalcUnitOpen}>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" role="combobox" className="w-20 justify-between font-normal px-2">
                              <span className={cn(!calcUnit && "text-muted-foreground")}>{calcUnit ?? "Unit"}</span>
                              <ChevronsUpDown className="size-3.5 opacity-50 shrink-0" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-36 p-0" align="start">
                            <Command>
                              <CommandList>
                                <CommandGroup>
                                  {compatibleUnits(calcIngredientRow.item_base_unit as UnitCode).map((u) => (
                                    <CommandItem key={u} value={u} onSelect={() => { setCalcUnit(u); setCalcUnitOpen(false); }}>
                                      <Check className={cn("size-4", calcUnit === u ? "opacity-100" : "opacity-0")} />
                                      {u}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </div>
                </div>

                {/* Calculation result */}
                {ingredientCalc !== null && (() => {
                  const yieldQty = selectedRecipe.yield_qty ?? 1;
                  const pcs = ingredientCalc.maxPossible * yieldQty;
                  const otherNeeded = computedRows
                    .filter((r) => r.item_id !== calcIngredientId)
                    .map((r) => ({
                      name: r.item_name,
                      qty: toDisplay(r.qty_per_batch * ingredientCalc.maxPossible, r.recipe_unit, r.displayUnit),
                      unit: r.displayUnit,
                    }));
                  return (
                    <div className="rounded-md border bg-muted/40 px-4 py-3 space-y-2 text-sm">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-muted-foreground">
                          {formatNum(calcQtyNum)} {calcUnit} {calcIngredientRow?.item_name} →
                        </span>
                        <span className="font-semibold tabular-nums text-base">
                          {formatNum(pcs)} {yieldUnit}
                        </span>
                      </div>

                      {/* Other ingredients needed */}
                      {otherNeeded.length > 0 && pcs > 0 && (
                        <div className="space-y-0.5">
                          <p className="text-xs text-muted-foreground">
                            For {formatNum(pcs)} {yieldUnit}, you need:
                          </p>
                          {otherNeeded.map((o) => (
                            <div key={o.name} className="flex items-center gap-1 text-xs tabular-nums">
                              <span className="text-muted-foreground">·</span>
                              <span className="font-medium">{formatNum(o.qty)} {o.unit}</span>
                              <span className="text-muted-foreground">{o.name}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {ingredientCalc.limitingIngredient ? (
                        <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="size-3.5 shrink-0" />
                          <span className="text-xs">
                            Limited by <strong>{ingredientCalc.limitingIngredient.name}</strong>
                            {" — "}max {formatNum(ingredientCalc.limitingIngredient.maxPreps * yieldQty)} {yieldUnit} possible
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400">
                          <CheckCircle2 className="size-3.5 shrink-0" />
                          <span className="text-xs">All ingredients available</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} />
        </div>
      </div>

      {/* Ingredients table — shown as soon as recipe is selected */}
      {selectedRecipe && computedRows.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Ingredients</h2>
          <div className="border table-outer rounded-lg overflow-x-auto">
            <Table className="w-full min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Ingredient</TableHead>
                  <TableHead className="w-28">Per prep</TableHead>
                  <TableHead className="w-28">Needed</TableHead>
                  <TableHead className="w-28">Available</TableHead>
                  <TableHead className="w-10 text-center">✓</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {computedRows.map((row, idx) => {
                  const du = row.displayUnit;
                  const fmt = (val: number) => formatNum(toDisplay(val, row.recipe_unit, du));
                  return (
                    <TableRow key={row.item_id}>
                      <TableCell className="text-muted-foreground text-sm tabular-nums">{idx + 1}</TableCell>
                      <TableCell className="text-sm font-medium">{row.item_name}</TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {formatNum(toDisplay(row.qty_per_batch, row.recipe_unit, du))} {du}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {row.needed !== null
                          ? <>{fmt(row.needed)} {du}</>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {fmt(row.available_in_recipe_unit)} {du}
                      </TableCell>
                      <TableCell className="text-center">
                        {validBatches && (
                          row.sufficient
                            ? <CheckCircle2 className="size-4 text-green-600 mx-auto" />
                            : <AlertTriangle className="size-4 text-destructive mx-auto" />
                        )}
                      </TableCell>
                      {/* Unit menu */}
                      <TableCell className="text-right">
                        {row.compatUnits.length > 1 && (
                          <UnitMenu
                            units={row.compatUnits}
                            value={du}
                            onChange={(u) => setRowDisplayUnit(row.item_id, u)}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {validBatches && (
            <p className="text-sm">
              {insufficientCount === 0
                ? <span className="text-green-700">All ingredients available</span>
                : <span className="text-destructive">{insufficientCount} ingredient{insufficientCount > 1 ? "s" : ""} insufficient</span>}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={() => router.push("/prep-orders")} disabled={pending}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={pending || !selectedRecipe || !validBatches}
        >
          {pending ? "Creating..." : "Create prep order"}
        </Button>
      </div>
    </div>
  );
}

function UnitMenu({
  units,
  value,
  onChange,
}: {
  units: string[];
  value: string;
  onChange: (u: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7">
          <MoreHorizontal className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-36 p-1" align="end">
        <div className="space-y-0.5">
          {units.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => { onChange(u); setOpen(false); }}
              className={cn(
                "w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent flex items-center gap-2",
                value === u && "font-medium bg-accent/50"
              )}
            >
              {value === u && <Check className="size-3.5 shrink-0" />}
              {value !== u && <span className="size-3.5 shrink-0" />}
              View in {u}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
