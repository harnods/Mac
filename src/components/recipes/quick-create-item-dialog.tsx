"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { createItem } from "@/app/actions/inventory";
import type { Item } from "@/lib/supabase/types";

type CreatedItem = Pick<Item, "id" | "name" | "unit" | "type">;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  /** Which types are selectable. Single entry = locked. */
  allowedTypes: Array<"ingredient" | "supply" | "prep_item">;
  units: string[];
  onCreated: (item: CreatedItem) => void;
};

const TYPE_LABELS: Record<string, string> = {
  ingredient: "Ingredient",
  supply: "Supply",
  prep_item: "Prep item",
};

export function QuickCreateItemDialog({
  open, onOpenChange, initialName, allowedTypes, units, onCreated,
}: Props) {
  const [pending, start] = useTransition();
  const [name, setName] = useState(initialName);
  const [type, setType] = useState<"ingredient" | "supply" | "prep_item">(allowedTypes[0]);
  const [unit, setUnit] = useState(units[0] ?? "pcs");
  const [unitOpen, setUnitOpen] = useState(false);
  const [unitSearch, setUnitSearch] = useState("");

  // Sync name + type when dialog re-opens
  useEffect(() => {
    if (open) {
      setName(initialName);
      setType(allowedTypes[0]);
      setUnit(units[0] ?? "pcs");
      setUnitSearch("");
    }
  }, [open, initialName, allowedTypes, units]);

  const exactUnitMatch = units.some((u) => u.toLowerCase() === unitSearch.toLowerCase());

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (!unit) { toast.error("Unit is required"); return; }

    start(async () => {
      const res = await createItem({ name: name.trim(), category_id: null, unit, type });
      if (!res.ok) { toast.error(res.error); return; }
      onCreated({ id: res.id!, name: name.trim(), unit, type });
      toast.success(`"${name.trim()}" created`);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Quick add item</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="qc-name">Name</Label>
            <Input
              id="qc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          {/* Type — only show if multiple types allowed */}
          {allowedTypes.length > 1 && (
            <div className="space-y-2">
              <Label>Type</Label>
              <div className="flex gap-4">
                {allowedTypes.map((t) => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="item-type"
                      value={t}
                      checked={type === t}
                      onChange={() => setType(t)}
                      className="accent-primary"
                    />
                    <span className="text-sm font-medium">{TYPE_LABELS[t]}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Unit */}
          <div className="space-y-2">
            <Label>Unit</Label>
            <Popover open={unitOpen} onOpenChange={setUnitOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
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
                    placeholder="Search unit..."
                    value={unitSearch}
                    onValueChange={setUnitSearch}
                  />
                  <CommandList>
                    <CommandEmpty>No units found.</CommandEmpty>
                    <CommandGroup>
                      {units
                        .filter((u) =>
                          !unitSearch || u.toLowerCase().includes(unitSearch.toLowerCase())
                        )
                        .map((u) => (
                          <CommandItem
                            key={u}
                            value={u}
                            onSelect={() => { setUnit(u); setUnitSearch(""); setUnitOpen(false); }}
                          >
                            <Check className={cn("size-4", unit === u ? "opacity-100" : "opacity-0")} />
                            {u}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <p className="text-xs text-muted-foreground">
            Category and other details can be set later from the inventory page.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating..." : "Create & select"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
