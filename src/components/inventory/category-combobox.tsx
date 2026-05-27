"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createCategory } from "@/app/actions/inventory";
import type { Category } from "@/lib/supabase/types";

type Option = Pick<Category, "id" | "name">;

export function CategoryCombobox({
  categories: initial,
  value,
  onChange,
  catType = "ingredient",
}: {
  categories: Option[];
  value: string | null;
  onChange: (id: string | null) => void;
  catType?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Option[]>(initial);
  const [pending, start] = useTransition();

  const selected = options.find((c) => c.id === value) ?? null;
  const trimmed = query.trim();
  const exactMatch = options.some(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
  );

  function handleCreate() {
    if (!trimmed || exactMatch) return;
    start(async () => {
      const res = await createCategory({ name: trimmed, type: catType });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const newCat: Option = { id: res.id!, name: trimmed };
      setOptions((prev) => [...prev, newCat].sort((a, b) => a.name.localeCompare(b.name)));
      onChange(newCat.id);
      setQuery("");
      setOpen(false);
      toast.success(`Category “${trimmed}” added`);
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn(!selected && "text-muted-foreground")}>
            {selected ? selected.name : "Select category"}
          </span>
          <div className="flex items-center gap-1">
            {selected && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear category"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(null);
                  }
                }}
                className="hover:bg-accent rounded-sm p-0.5 cursor-pointer"
              >
                <X className="size-3.5 text-muted-foreground" />
              </span>
            )}
            <ChevronsUpDown className="size-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter>
          <CommandInput
            placeholder=""
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {options.length === 0 && !trimmed && (
              <CommandEmpty>No categories yet — type to create one.</CommandEmpty>
            )}
            {trimmed && !exactMatch && (
              <CommandGroup>
                <CommandItem
                  value={`__create__${trimmed}`}
                  onSelect={handleCreate}
                  disabled={pending}
                  className="text-primary"
                >
                  <Plus className="size-4" />
                  Add “{trimmed}” as new category
                </CommandItem>
              </CommandGroup>
            )}
            {options.length > 0 && (
              <CommandGroup heading="Categories">
                {options.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.name}
                    onSelect={() => {
                      onChange(c.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "size-4",
                        value === c.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {c.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {!trimmed && options.length > 0 && (
              <CommandEmpty className="hidden">No results.</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
