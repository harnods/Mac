"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Check, ChevronsUpDown, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { compatibleUnits, parseDecimal } from "@/lib/units";
import { UNITS } from "@/lib/units";
import { createRecipe, updateRecipe } from "@/app/actions/recipes";
import { createUnit } from "@/app/actions/units";
import { createItem } from "@/app/actions/inventory";
import { QuickCreateItemDialog } from "./quick-create-item-dialog";
import type { Item, Recipe, RecipeItemWithItem, UnitCode } from "@/lib/supabase/types";
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

type IngredientRow = {
  key: string;
  item_id: string | null;
  quantity: string;
  unit: UnitCode | null;
  substitutes: string[]; // item_ids
};

function newRow(): IngredientRow {
  return { key: crypto.randomUUID(), item_id: null, quantity: "", unit: null, substitutes: [] };
}

export function RecipeForm({
  items,
  products,
  recipe,
  recipeItems,
  units: initialUnits = [],
}: {
  items: Pick<Item, "id" | "name" | "unit" | "type">[];
  products: Pick<Item, "id" | "name" | "unit" | "type">[];
  recipe?: Recipe & { unit?: string | null };
  recipeItems?: RecipeItemWithItem[];
  units?: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const isEdit = !!recipe;

  // Prefer the stored recipe_type column; fall back to heuristics for old records.
  const storedType = (recipe as (typeof recipe & { recipe_type?: string }) | undefined)?.recipe_type;
  const linkedProductType = recipe?.product_id
    ? products.find((p) => p.id === recipe.product_id)?.type
    : undefined;
  const hasPrepItemIngredient = recipeItems?.some(
    (ri) => items.find((i) => i.id === ri.item_id)?.type === "prep_item"
  );

  const initialType: "wip" | "product" =
    storedType === "wip" || storedType === "product" ? storedType
    : linkedProductType === "prep_item" ? "wip"
    : linkedProductType === "product"   ? "product"
    : hasPrepItemIngredient             ? "product"
    : recipe?.product_id                ? "product"
    : "wip";

  const [recipeType, setRecipeType] = useState<"wip" | "product">(initialType);
  const [name, setName] = useState(recipe?.name ?? "");
  const [productId, setProductId] = useState<string | null>(recipe?.product_id ?? null);
  const [yieldQty, setYieldQty] = useState(String(recipe?.yield_qty ?? 1));
  const [yieldUnit, setYieldUnit] = useState<string>(recipe?.unit ?? "pcs");
  const [yieldUnitOpen, setYieldUnitOpen] = useState(false);
  const [yieldUnitSearch, setYieldUnitSearch] = useState("");
  const [units, setUnits] = useState(initialUnits);
  const [creatingUnit, startCreateUnit] = useTransition();
  const [productOpen, setProductOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [creatingOutput, startCreateOutput] = useTransition();
  const [extraOutputItems, setExtraOutputItems] = useState<Pick<Item, "id" | "name" | "unit" | "type">[]>([]);
  const [extraIngredientItems, setExtraIngredientItems] = useState<Pick<Item, "id" | "name" | "unit" | "type">[]>([]);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateName, setQuickCreateName] = useState("");
  const [quickCreateRowKey, setQuickCreateRowKey] = useState<string | null>(null);
  const [quickCreateMode, setQuickCreateMode] = useState<"ingredient" | "substitute">("ingredient");

  // Weight per pcs (optional)
  const [weightPerPcs, setWeightPerPcs] = useState(
    recipe && (recipe as Recipe & { weight_per_pcs?: number | null }).weight_per_pcs
      ? String((recipe as Recipe & { weight_per_pcs?: number | null }).weight_per_pcs)
      : ""
  );
  const [weightUnit, setWeightUnit] = useState<string>(
    (recipe as Recipe & { weight_unit?: string | null } | undefined)?.weight_unit ?? "g"
  );
  const [weightUnitOpen, setWeightUnitOpen] = useState(false);

  const filteredOutputItems = [
    ...products.filter((p) => recipeType === "wip" ? p.type === "prep_item" : p.type === "product"),
    ...extraOutputItems.filter((p) => recipeType === "wip" ? p.type === "prep_item" : p.type === "product"),
  ];
  const outputExactMatch = filteredOutputItems.some(
    (p) => p.name.toLowerCase() === productSearch.toLowerCase()
  );

  function handleQuickAddOutputItem() {
    if (!productSearch.trim() || outputExactMatch || creatingOutput) return;
    const itemName = productSearch.trim();
    const itemType = recipeType === "wip" ? "prep_item" : "product";
    startCreateOutput(async () => {
      const res = await createItem({ name: itemName, category_id: null, unit: "pcs", type: itemType });
      if (!res.ok) { toast.error(res.error); return; }
      const newItem: Pick<Item, "id" | "name" | "unit" | "type"> = {
        id: res.id!,
        name: itemName,
        unit: "pcs",
        type: itemType,
      };
      setExtraOutputItems((prev) => [...prev, newItem]);
      setProductId(res.id!);
      if (recipeType === "wip") setYieldUnit("pcs");
      setProductSearch("");
      setProductOpen(false);
      toast.success(`"${itemName}" created`);
    });
  }
  const filteredIngredients = [
    ...items.filter((i) => recipeType === "wip" ? i.type === "ingredient" : true),
    ...extraIngredientItems.filter((i) => recipeType === "wip" ? i.type === "ingredient" : true),
  ];
  const allowedIngredientTypes: Array<"ingredient" | "supply" | "prep_item"> =
    recipeType === "wip" ? ["ingredient"] : ["ingredient", "supply", "prep_item"];

  const [rows, setRows] = useState<IngredientRow[]>(() => {
    if (recipeItems && recipeItems.length > 0) {
      return [
        ...recipeItems.map((ri) => ({
          key: ri.id,
          item_id: ri.item_id,
          quantity: String(ri.quantity),
          unit: ri.unit,
          substitutes: (ri as typeof ri & { substitutes?: { item_id: string }[] }).substitutes?.map((s) => s.item_id) ?? [],
        })),
        newRow(),
      ];
    }
    return [newRow()];
  });

  const exactUnitMatch = units.some(
    (u) => u.toLowerCase() === yieldUnitSearch.toLowerCase()
  );

  function handleQuickAddUnit() {
    if (!yieldUnitSearch.trim() || exactUnitMatch) return;
    const code = yieldUnitSearch.trim();
    startCreateUnit(async () => {
      const res = await createUnit({ code });
      if (!res.ok) { toast.error(res.error); return; }
      setUnits((prev) => [...prev, code].sort());
      setYieldUnit(code);
      setYieldUnitSearch("");
      setYieldUnitOpen(false);
      toast.success(`Unit "${code}" created`);
    });
  }

  function removeRow(key: string) {
    setRows((prev) => {
      const filtered = prev.filter((r) => r.key !== key);
      // Always keep at least one row (trailing empty row)
      if (filtered.length === 0) return [newRow()];
      return filtered;
    });
  }

  function updateRow(key: string, patch: Partial<IngredientRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function handleItemSelect(key: string, itemId: string) {
    const item = filteredIngredients.find((i) => i.id === itemId);
    updateRow(key, { item_id: itemId, unit: item?.unit ?? null });
    // Ensure trailing empty row after selection
    setRows((prev) => {
      const last = prev[prev.length - 1];
      if (last.item_id) return [...prev, newRow()];
      return prev;
    });
  }

  function handleMultiItemSelect(key: string, itemIds: string[]) {
    if (itemIds.length === 0) return;
    // Filter out items already used in other rows
    const otherUsed = new Set(rows.filter((r) => r.key !== key && r.item_id).map((r) => r.item_id!));
    const filtered = itemIds.filter((id) => !otherUsed.has(id));
    if (filtered.length === 0) return;
    const [first, ...rest] = filtered;
    // Set first item on current row
    const firstItem = filteredIngredients.find((i) => i.id === first);
    updateRow(key, { item_id: first, unit: firstItem?.unit ?? null });
    // Add new rows for remaining items
    if (rest.length > 0) {
      setRows((prev) => {
        const idx = prev.findIndex((r) => r.key === key);
        const newRows = rest.map((id) => {
          const it = filteredIngredients.find((i) => i.id === id);
          return { ...newRow(), item_id: id, unit: it?.unit ?? null } as IngredientRow;
        });
        const updated = [...prev.slice(0, idx + 1), ...newRows, ...prev.slice(idx + 1)];
        // Ensure there's always a trailing empty row
        const last = updated[updated.length - 1];
        if (last.item_id) updated.push(newRow());
        return updated;
      });
    } else {
      // Single item, still ensure trailing empty row
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
    const weightNum = parseDecimal(weightPerPcs);
    const payload = {
      name,
      recipe_type: recipeType,
      product_id: productId ?? null,
      yield_qty: parseDecimal(yieldQty),
      unit: recipeType === "wip" ? yieldUnit : null,
      weight_per_pcs: !isNaN(weightNum) && weightNum > 0 ? weightNum : null,
      weight_unit: !isNaN(weightNum) && weightNum > 0 ? weightUnit : null,
      items: rows
        .filter((r) => r.item_id && r.quantity && r.unit)
        .map((r) => ({ item_id: r.item_id!, quantity: r.quantity, unit: r.unit!, substitutes: r.substitutes })),
    };
    start(async () => {
      const res = isEdit
        ? await updateRecipe(recipe!.id, payload)
        : await createRecipe(payload);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(isEdit ? "Recipe updated" : "Recipe created");
      router.push(isEdit ? `/recipes/${recipe!.id}` : "/recipes");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* Recipe type */}
      <div className="space-y-2">
        <Label>Recipe type</Label>
        <div className="flex gap-4 pt-0.5">
          {(["wip", "product"] as const).map((t) => (
            <label key={t} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="radio"
                name="recipeType"
                value={t}
                checked={recipeType === t}
                onChange={() => { setRecipeType(t); setProductId(null); setYieldQty("1"); setProductSearch(""); setExtraOutputItems([]); }}
                className="accent-primary"
              />
              <span className="text-sm font-medium">
                {t === "wip" ? "WIP (prep item)" : "Product"}
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {recipeType === "wip"
            ? "Recipe for a prep item — ingredients are raw ingredients, output is a prep item."
            : "Recipe for a finished product — ingredients can include prep items (WIP)."}
        </p>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      {/* Output item */}
      <div className="space-y-2">
        <Label>Output item</Label>
        <Popover open={productOpen} onOpenChange={setProductOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              className="w-full justify-between font-normal"
            >
              <span className={cn("truncate", !productId && "text-muted-foreground")}>
                {filteredOutputItems.find((p) => p.id === productId)?.name ?? "Select item"}
              </span>
              <ChevronsUpDown className="size-4 opacity-50 shrink-0 ml-1" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Search or create..."
                value={productSearch}
                onValueChange={setProductSearch}
              />
              <CommandList>
                <CommandEmpty>
                  {productSearch.trim() ? (
                    <button
                      type="button"
                      className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-2"
                      onClick={handleQuickAddOutputItem}
                      disabled={creatingOutput}
                    >
                      <Plus className="size-3.5" />
                      {creatingOutput ? "Creating..." : `Create "${productSearch.trim()}"`}
                    </button>
                  ) : "No items found."}
                </CommandEmpty>
                <CommandGroup>
                  {productId && (
                    <CommandItem
                      value="__clear__"
                      onSelect={() => { setProductId(null); setYieldQty("1"); setProductSearch(""); setProductOpen(false); }}
                    >
                      <Check className="size-4 opacity-0" />
                      <span className="text-muted-foreground">None</span>
                    </CommandItem>
                  )}
                  {filteredOutputItems.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={`${p.id} ${p.name} ${p.type}`}
                      onSelect={() => {
                        setProductId(p.id);
                        if (recipeType === "wip") setYieldUnit(p.unit || "pcs");
                        setProductSearch("");
                        setProductOpen(false);
                      }}
                    >
                      <Check className={cn("size-4", productId === p.id ? "opacity-100" : "opacity-0")} />
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">
                        {p.type === "prep_item" ? "Prep item" : "Product"}
                      </span>
                    </CommandItem>
                  ))}
                  {productSearch.trim() && !outputExactMatch && (
                    <CommandItem
                      value={`__create__${productSearch}`}
                      onSelect={handleQuickAddOutputItem}
                      disabled={creatingOutput}
                      className="text-muted-foreground"
                    >
                      <Plus className="size-4" />
                      {creatingOutput ? "Creating..." : `Create "${productSearch.trim()}"`}
                    </CommandItem>
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Yield — WIP: qty + unit picker with quick-add; Product: qty + readonly unit */}
      {productId && (
        <div className="space-y-2">
          <Label>Yield per prep</Label>
          <div className="flex items-center gap-2">
            <DecimalInput
              min="0.001"
              step="any"
              required
              value={yieldQty}
              onValueChange={(v) => setYieldQty(v)}
              className="w-28"
            />
            {recipeType === "wip" ? (
              /* Unit picker with quick-add for WIP */
              <Popover open={yieldUnitOpen} onOpenChange={setYieldUnitOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className="w-32 justify-between font-normal px-2"
                  >
                    <span className={cn(!yieldUnit && "text-muted-foreground")}>
                      {yieldUnit || "Unit"}
                    </span>
                    <ChevronsUpDown className="size-3.5 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search or create..."
                      value={yieldUnitSearch}
                      onValueChange={setYieldUnitSearch}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {yieldUnitSearch.trim() ? (
                          <button
                            type="button"
                            className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-2"
                            onClick={handleQuickAddUnit}
                            disabled={creatingUnit}
                          >
                            <Plus className="size-3.5" />
                            {creatingUnit ? "Creating..." : `Create "${yieldUnitSearch.trim()}"`}
                          </button>
                        ) : "No units found."}
                      </CommandEmpty>
                      <CommandGroup>
                        {units.map((u) => (
                          <CommandItem
                            key={u}
                            value={u}
                            onSelect={() => { setYieldUnit(u); setYieldUnitSearch(""); setYieldUnitOpen(false); }}
                          >
                            <Check className={cn("size-4", yieldUnit === u ? "opacity-100" : "opacity-0")} />
                            {u}
                          </CommandItem>
                        ))}
                        {yieldUnitSearch.trim() && !exactUnitMatch && (
                          <CommandItem
                            value={`__create__${yieldUnitSearch}`}
                            onSelect={handleQuickAddUnit}
                            disabled={creatingUnit}
                            className="text-muted-foreground"
                          >
                            <Plus className="size-4" />
                            {creatingUnit ? "Creating..." : `Create "${yieldUnitSearch.trim()}"`}
                          </CommandItem>
                        )}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            ) : (
              /* Readonly unit label for Product */
              <span className="text-sm text-muted-foreground">
                {filteredOutputItems.find((p) => p.id === productId)?.unit ?? "pcs"}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Weight per pcs (optional) */}
      {productId && (
        <div className="space-y-2">
          <Label>
            Weight per pcs{" "}
            <span className="text-muted-foreground font-normal text-xs">(optional)</span>
          </Label>
          <div className="flex items-center gap-2">
            <DecimalInput
              min="0.001"
              step="any"
              value={weightPerPcs}
              onValueChange={(v) => setWeightPerPcs(v)}
              placeholder="e.g. 150"
              className="w-28"
            />
            <Popover open={weightUnitOpen} onOpenChange={setWeightUnitOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  className="w-24 justify-between font-normal px-2"
                >
                  <span>{weightUnit}</span>
                  <ChevronsUpDown className="size-3.5 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search unit..." />
                  <CommandList>
                    <CommandEmpty>No units found.</CommandEmpty>
                    <CommandGroup>
                      {units.map((u) => (
                        <CommandItem
                          key={u}
                          value={u}
                          onSelect={() => { setWeightUnit(u); setWeightUnitOpen(false); }}
                        >
                          <Check className={cn("size-4", weightUnit === u ? "opacity-100" : "opacity-0")} />
                          {u}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}

      {/* Ingredients */}
      <div className="space-y-3">
        <Label>Ingredients</Label>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rows.map((r) => r.key)} strategy={verticalListSortingStrategy}>
            {rows.map((row, idx) => {
              const isTrailingEmpty = !row.item_id && idx === rows.length - 1;
              return (
                <IngredientRowField
                  key={row.key}
                  id={row.key}
                  row={row}
                  index={idx}
                  items={filteredIngredients}
                  canDrag={!isTrailingEmpty}
                  onItemSelect={(itemId) => handleItemSelect(row.key, itemId)}
                  onMultiItemSelect={(ids) => handleMultiItemSelect(row.key, ids)}
                  onQtyChange={(qty) => updateRow(row.key, { quantity: qty })}
                  onUnitChange={(unit) => updateRow(row.key, { unit })}
                  onSubstitutesChange={(subs) => updateRow(row.key, { substitutes: subs })}
                  onRemove={rows.length > 1 && !isTrailingEmpty ? () => removeRow(row.key) : undefined}
                  onQuickCreate={(name) => {
                    setQuickCreateMode("ingredient");
                    setQuickCreateName(name);
                    setQuickCreateRowKey(row.key);
                    setQuickCreateOpen(true);
                  }}
                  onQuickCreateSub={(name) => {
                    setQuickCreateMode("substitute");
                    setQuickCreateName(name);
                    setQuickCreateRowKey(row.key);
                    setQuickCreateOpen(true);
                  }}
                />
              );
            })}
          </SortableContext>
        </DndContext>
      </div>

      <QuickCreateItemDialog
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        initialName={quickCreateName}
        allowedTypes={allowedIngredientTypes}
        units={units}
        onCreated={(newItem) => {
          setExtraIngredientItems((prev) => [...prev, newItem]);
          if (quickCreateRowKey) {
            if (quickCreateMode === "substitute") {
              setRows((prev) =>
                prev.map((r) =>
                  r.key === quickCreateRowKey
                    ? { ...r, substitutes: [...r.substitutes, newItem.id] }
                    : r
                )
              );
            } else {
              updateRow(quickCreateRowKey, { item_id: newItem.id, unit: newItem.unit as UnitCode });
            }
          }
        }}
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : isEdit ? "Save changes" : "Create recipe"}
        </Button>
      </div>
    </form>
  );
}

function IngredientRowField({
  id,
  row,
  index,
  items,
  canDrag,
  onItemSelect,
  onMultiItemSelect,
  onQtyChange,
  onUnitChange,
  onSubstitutesChange,
  onRemove,
  onQuickCreate,
  onQuickCreateSub,
}: {
  id: string;
  row: IngredientRow;
  index: number;
  items: Pick<Item, "id" | "name" | "unit" | "type">[];
  canDrag: boolean;
  onItemSelect: (id: string) => void;
  onMultiItemSelect: (ids: string[]) => void;
  onQtyChange: (qty: string) => void;
  onUnitChange: (unit: UnitCode) => void;
  onSubstitutesChange: (substitutes: string[]) => void;
  onRemove?: () => void;
  onQuickCreate: (name: string) => void;
  onQuickCreateSub: (name: string) => void;
}) {
  const [itemOpen, setItemOpen] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [pendingIds, setPendingIds] = useState<string[]>([]);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const selectedItem = items.find((i) => i.id === row.item_id) ?? null;
  const units = selectedItem ? compatibleUnits(selectedItem.unit) : [];
  const exactMatch = items.some((i) => i.name.toLowerCase() === itemSearch.toLowerCase());

  // Substitutes
  const [subOpen, setSubOpen] = useState(false);
  const [subSearch, setSubSearch] = useState("");
  const subCandidates = items.filter(
    (i) => i.id !== row.item_id && !row.substitutes.includes(i.id)
  );
  const subExactMatch = subCandidates.some(
    (i) => i.name.toLowerCase() === subSearch.toLowerCase()
  );
  function addSub(itemId: string) {
    onSubstitutesChange([...row.substitutes, itemId]);
    setSubSearch("");
    setSubOpen(false);
  }
  function removeSub(itemId: string) {
    onSubstitutesChange(row.substitutes.filter((s) => s !== itemId));
  }

  function triggerQuickCreate() {
    setItemOpen(false);
    onQuickCreate(itemSearch.trim());
    setItemSearch("");
  }

  function handleOpenChange(open: boolean) {
    if (open) {
      setPendingIds(row.item_id ? [row.item_id] : []);
    } else {
      // On close without confirming: cancel (no-op, don't apply)
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
    <div ref={setNodeRef} style={style}>
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
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search or create..."
              value={itemSearch}
              onValueChange={setItemSearch}
            />
            <CommandList>
              <CommandEmpty>
                {itemSearch.trim() ? (
                  <button
                    type="button"
                    className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-2"
                    onClick={triggerQuickCreate}
                  >
                    <Plus className="size-3.5" />
                    Create &ldquo;{itemSearch.trim()}&rdquo;
                  </button>
                ) : "No items found."}
              </CommandEmpty>
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
                    <span className="text-xs text-muted-foreground ml-2 shrink-0 capitalize">{item.type}</span>
                  </CommandItem>
                ))}
                {itemSearch.trim() && !exactMatch && (
                  <CommandItem
                    value={`__create__${itemSearch}`}
                    onSelect={triggerQuickCreate}
                    className="text-muted-foreground"
                  >
                    <Plus className="size-4" />
                    Create &ldquo;{itemSearch.trim()}&rdquo;
                  </CommandItem>
                )}
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

      <DecimalInput
        min="0"
        step="any"
        value={row.quantity}
        onValueChange={(v) => onQtyChange(v)}
        className="w-24 shrink-0"
      />

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
        <PopoverContent className="w-40 p-0" align="start">
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
                    {UNITS.find((x) => x.code === u)?.label ?? u}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        disabled={!onRemove}
        className={cn("shrink-0 text-muted-foreground hover:text-destructive", !onRemove && "invisible")}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>

    {/* Substitutes — only when an item is selected */}
    {row.item_id && (
      <div className="ml-[4.5rem] flex flex-wrap items-center gap-1.5 mt-1 mb-0.5">
        <span className="text-xs text-muted-foreground shrink-0">Sub:</span>
        {row.substitutes.map((subId) => {
          const subItem = items.find((i) => i.id === subId);
          return (
            <span
              key={subId}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs"
            >
              {subItem?.name ?? subId}
              <button
                type="button"
                onClick={() => removeSub(subId)}
                className="text-muted-foreground hover:text-foreground leading-none"
              >
                ×
              </button>
            </span>
          );
        })}
        <Popover open={subOpen} onOpenChange={setSubOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
            >
              <Plus className="size-3" />
              Add substitute
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Search item..."
                value={subSearch}
                onValueChange={setSubSearch}
              />
              <CommandList>
                <CommandEmpty>
                  {subSearch.trim() ? (
                    <button
                      type="button"
                      className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-2"
                      onClick={() => { setSubOpen(false); onQuickCreateSub(subSearch.trim()); setSubSearch(""); }}
                    >
                      <Plus className="size-3.5" />
                      Create &ldquo;{subSearch.trim()}&rdquo;
                    </button>
                  ) : "No items found."}
                </CommandEmpty>
                <CommandGroup>
                  {subCandidates
                    .filter((i) => !subSearch.trim() || i.name.toLowerCase().includes(subSearch.toLowerCase()))
                    .map((i) => (
                      <CommandItem key={i.id} value={i.name} onSelect={() => addSub(i.id)}>
                        <span className="flex-1 truncate">{i.name}</span>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">{i.unit}</span>
                      </CommandItem>
                    ))}
                  {subSearch.trim() && !subExactMatch && (
                    <CommandItem
                      value={`__create__${subSearch}`}
                      onSelect={() => { setSubOpen(false); onQuickCreateSub(subSearch.trim()); setSubSearch(""); }}
                      className="text-muted-foreground"
                    >
                      <Plus className="size-4" />
                      Create &ldquo;{subSearch.trim()}&rdquo;
                    </CommandItem>
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    )}
    </div>
  );
}
