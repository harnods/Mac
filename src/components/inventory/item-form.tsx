"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { CategoryCombobox } from "./category-combobox";
import { ITEM_TYPE_CONFIG } from "@/lib/item-types";
import { compatibleUnits } from "@/lib/units";
import { createItem, updateItem } from "@/app/actions/inventory";
import { createUnit } from "@/app/actions/units";
import type { Category, Item } from "@/lib/supabase/types";
import type { ItemTypeSlug } from "@/lib/item-types";
import type { UnitCode } from "@/lib/supabase/types";

type Props = {
  categories: Pick<Category, "id" | "name">[];
  units: string[];
  item?: Item;
  itemTypeSlug: ItemTypeSlug;
  hasCategories: boolean;
  unitLocked?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
};

function defaultUnitFor(_slug: ItemTypeSlug): string {
  return "pcs";
}

export function ItemForm({ categories, units: initialUnits, item, itemTypeSlug, hasCategories, unitLocked = false, onSuccess, onCancel }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(item?.name ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(item?.category_id ?? null);
  const [unit, setUnit] = useState<string>(item?.unit ?? defaultUnitFor(itemTypeSlug));
  const [unitOpen, setUnitOpen] = useState(false);
  const [unitSearch, setUnitSearch] = useState("");
  const [units, setUnits] = useState(initialUnits);
  const [creatingUnit, startCreateUnit] = useTransition();

  const isEdit = !!item;
  const config = ITEM_TYPE_CONFIG[itemTypeSlug];

  const lockedUnits = unitLocked
    ? units.filter((u) => compatibleUnits(item!.unit as UnitCode).includes(u as UnitCode))
    : units;
  const fullyLocked = unitLocked && lockedUnits.length <= 1;

  const visibleUnits = unitLocked ? lockedUnits : units;
  const exactMatch = visibleUnits.some((u) => u.toLowerCase() === unitSearch.toLowerCase());

  function handleQuickAddUnit() {
    if (!unitSearch.trim() || exactMatch || unitLocked) return;
    const code = unitSearch.trim();
    startCreateUnit(async () => {
      const res = await createUnit({ code });
      if (!res.ok) { toast.error(res.error); return; }
      setUnits((prev) => [...prev, code].sort());
      setUnit(code);
      setUnitSearch("");
      setUnitOpen(false);
      toast.success(`Unit "${code}" created`);
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const payload = {
        name,
        category_id: hasCategories ? categoryId : null,
        unit,
        type: config.dbType,
      };
      const res = isEdit ? await updateItem(item!.id, payload) : await createItem(payload);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(isEdit ? "Saved" : "Created");
      router.refresh();
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(isEdit ? `/inventory/${itemTypeSlug}/${item!.id}` : `/inventory/${itemTypeSlug}`);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {hasCategories && (
        <div className="space-y-2">
          <Label>Category</Label>
          <CategoryCombobox
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
            catType={config.dbType}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>Unit</Label>
        {fullyLocked ? (
          <div className="flex items-center gap-2">
            <div className="border rounded-md px-3 py-2 text-sm bg-muted text-muted-foreground w-full">
              {unit}
            </div>
            <span className="text-xs text-muted-foreground shrink-0">Locked — no compatible units</span>
          </div>
        ) : (
          <>
            <Popover open={unitOpen} onOpenChange={setUnitOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={unitOpen}
                  className="w-full justify-between font-normal"
                >
                  <span className={cn(!unit && "text-muted-foreground")}>
                    {unit || "Select unit"}
                  </span>
                  <ChevronsUpDown className="size-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder={unitLocked ? "Search units..." : "Search or create unit..."}
                    value={unitSearch}
                    onValueChange={setUnitSearch}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {!unitLocked && unitSearch.trim() ? (
                        <button
                          type="button"
                          className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-2"
                          onClick={handleQuickAddUnit}
                          disabled={creatingUnit}
                        >
                          <Plus className="size-3.5" />
                          {creatingUnit ? "Creating..." : `Create "${unitSearch.trim()}"`}
                        </button>
                      ) : "No units found."}
                    </CommandEmpty>
                    <CommandGroup>
                      {visibleUnits.map((u) => (
                        <CommandItem
                          key={u}
                          value={u}
                          onSelect={() => { setUnit(u); setUnitSearch(""); setUnitOpen(false); }}
                        >
                          <Check className={cn("size-4", unit === u ? "opacity-100" : "opacity-0")} />
                          {u}
                        </CommandItem>
                      ))}
                      {!unitLocked && unitSearch.trim() && !exactMatch && (
                        <CommandItem
                          value={`__create__${unitSearch}`}
                          onSelect={handleQuickAddUnit}
                          disabled={creatingUnit}
                          className="text-muted-foreground"
                        >
                          <Plus className="size-4" />
                          {creatingUnit ? "Creating..." : `Create "${unitSearch.trim()}"`}
                        </CommandItem>
                      )}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {unitLocked && (
              <p className="text-xs text-muted-foreground">
                Only compatible units shown — has existing transactions.
              </p>
            )}
          </>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={() => onCancel ? onCancel() : router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : isEdit ? "Save changes" : `Create ${config.singular.toLowerCase()}`}
        </Button>
      </div>
    </form>
  );
}
