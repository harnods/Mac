"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
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
import { createUnit } from "@/app/actions/units";

type Props = {
  units: string[];
  onUnitsChange?: (units: string[]) => void;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowCreate?: boolean;
};

export function UnitCombobox({ units, onUnitsChange, value, onChange, placeholder = "Select unit", allowCreate = true }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, startCreating] = useTransition();
  const exactMatch = units.some((u) => u.toLowerCase() === search.toLowerCase());

  function handleQuickAdd() {
    if (!search.trim() || exactMatch || !allowCreate) return;
    const code = search.trim();
    startCreating(async () => {
      const res = await createUnit({ code });
      if (!res.ok) { toast.error(res.error); return; }
      onUnitsChange?.([...units, code].sort());
      onChange(code);
      setSearch("");
      setOpen(false);
      toast.success(`Unit "${code}" created`);
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className={cn(!value && "text-muted-foreground")}>{value || placeholder}</span>
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput
            placeholder={allowCreate ? "Search or create unit..." : "Search units..."}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {allowCreate && search.trim() ? (
                <button
                  type="button"
                  className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-2"
                  onClick={handleQuickAdd}
                  disabled={creating}
                >
                  <Plus className="size-3.5" />
                  {creating ? "Creating..." : `Create "${search.trim()}"`}
                </button>
              ) : "No units found."}
            </CommandEmpty>
            <CommandGroup>
              {units.map((u) => (
                <CommandItem key={u} value={u} onSelect={() => { onChange(u); setSearch(""); setOpen(false); }}>
                  <Check className={cn("size-4", value === u ? "opacity-100" : "opacity-0")} />
                  {u}
                </CommandItem>
              ))}
              {allowCreate && search.trim() && !exactMatch && (
                <CommandItem value={`__create__${search}`} onSelect={handleQuickAdd} disabled={creating} className="text-muted-foreground">
                  <Plus className="size-4" />
                  {creating ? "Creating..." : `Create "${search.trim()}"`}
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
