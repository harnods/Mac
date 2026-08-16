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
import { createLocation } from "@/app/actions/locations";
import type { Location } from "@/lib/supabase/types";

type Option = Pick<Location, "id" | "name">;

export function LocationCombobox({
  locations: initial,
  value,
  onChange,
}: {
  locations: Option[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Option[]>(initial);
  const [pending, start] = useTransition();

  const selected = options.find((c) => c.id === value) ?? null;
  const trimmed = query.trim();
  const exactMatch = options.some((c) => c.name.toLowerCase() === trimmed.toLowerCase());

  function handleCreate() {
    if (!trimmed || exactMatch) return;
    start(async () => {
      const res = await createLocation({ name: trimmed });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const created: Option = { id: res.id!, name: trimmed };
      setOptions((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      onChange(created.id);
      setQuery("");
      setOpen(false);
      toast.success(`Location “${trimmed}” added`);
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
            {selected ? selected.name : "Select location"}
          </span>
          <div className="flex items-center gap-1">
            {selected && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear location"
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
          <CommandInput placeholder="" value={query} onValueChange={setQuery} />
          <CommandList>
            {options.length === 0 && !trimmed && (
              <CommandEmpty>No locations yet — type to create one.</CommandEmpty>
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
                  Add “{trimmed}” as new location
                </CommandItem>
              </CommandGroup>
            )}
            {options.length > 0 && (
              <CommandGroup heading="Locations">
                {options.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.name}
                    onSelect={() => {
                      onChange(c.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("size-4", value === c.id ? "opacity-100" : "opacity-0")} />
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
