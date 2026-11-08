"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addItemSuppliers } from "@/app/actions/item-suppliers";

export type SupplierOption = { id: string; name: string };

/**
 * Link one supplier to one or more ingredients. Used from the ingredient list
 * (row kebab + bulk) and the ingredient detail "Suppliers" tab.
 * Adding never removes existing suppliers; the first supplier of an ingredient
 * becomes its primary automatically.
 */
export function AddSupplierDialog({
  open,
  onOpenChange,
  itemIds,
  suppliers,
  excludeSupplierIds = [],
  allowPrimary = false,
  title,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemIds: string[];
  suppliers: SupplierOption[];
  /** Suppliers already linked (single-item context) — hidden from the picker. */
  excludeSupplierIds?: string[];
  /** Show the "Set as primary" toggle (single-item contexts only). */
  allowPrimary?: boolean;
  title?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [makePrimary, setMakePrimary] = useState(false);

  const options = suppliers.filter((s) => !excludeSupplierIds.includes(s.id));
  const selected = options.find((s) => s.id === supplierId) ?? null;

  function reset() {
    setSupplierId(null);
    setMakePrimary(false);
  }

  function submit() {
    if (!supplierId) return;
    start(async () => {
      const res = await addItemSuppliers({
        itemIds,
        supplierIds: [supplierId],
        makePrimary: allowPrimary && makePrimary,
      });
      if (!res.ok) { toast.error(res.error); return; }
      const name = selected?.name ?? "Supplier";
      if (itemIds.length > 1) {
        const skipped = itemIds.length - (res.added ?? 0);
        toast.success(
          `${name} added to ${res.added ?? 0} ingredient${res.added === 1 ? "" : "s"}` +
            (skipped > 0 ? ` (${skipped} already linked)` : ""),
        );
      } else {
        toast.success(`${name} added`);
      }
      reset();
      onOpenChange(false);
      onDone?.();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title ?? "Add supplier"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Supplier</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={pickerOpen}
                  className="w-full justify-between font-normal"
                >
                  <span className={cn(!selected && "text-muted-foreground")}>
                    {selected ? selected.name : "Select supplier"}
                  </span>
                  <ChevronsUpDown className="size-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="" />
                  <CommandList>
                    <CommandEmpty>
                      {suppliers.length === 0 ? "No suppliers yet — add one in Purchasing → Suppliers." : "No suppliers found."}
                    </CommandEmpty>
                    <CommandGroup>
                      {options.map((s) => (
                        <CommandItem
                          key={s.id}
                          value={s.name}
                          onSelect={() => { setSupplierId(s.id); setPickerOpen(false); }}
                        >
                          <Check className={cn("size-4", supplierId === s.id ? "opacity-100" : "opacity-0")} />
                          {s.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {allowPrimary && (
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="make-primary" className="font-normal">Set as primary supplier</Label>
              <Switch id="make-primary" checked={makePrimary} onCheckedChange={setMakePrimary} />
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
            <Button type="submit" disabled={pending || !supplierId}>
              {pending ? "Adding…" : "Add supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
