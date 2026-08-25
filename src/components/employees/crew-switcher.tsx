"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type CrewOption = { id: string; name: string; status: "active" | "inactive" | "resigned" };

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  inactive: { label: "Inactive", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  resigned: { label: "Resigned", className: "" },
};

export function CrewSwitcher({ currentId, name, crew }: { currentId: string; name: string; crew: CrewOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  // Default (no search) shows only active crew; searching spans everyone.
  const list = (q ? crew.filter((c) => c.name.toLowerCase().includes(q)) : crew.filter((c) => c.status === "active"))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group flex items-center gap-1.5 rounded-md text-2xl font-semibold tracking-tight outline-none hover:text-foreground/80"
          aria-label="Switch crew"
        >
          {name}
          <ChevronDown className="size-5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search crew..." value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>No crew found.</CommandEmpty>
            <CommandGroup heading={q ? "All crew" : "Active crew"}>
              {list.map((c) => {
                const badge = STATUS_BADGE[c.status];
                return (
                  <CommandItem
                    key={c.id}
                    value={c.id}
                    onSelect={() => {
                      setOpen(false);
                      setQuery("");
                      if (c.id !== currentId) router.push(`/hr/crew/${c.id}`);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Check className={cn("size-4 shrink-0", c.id === currentId ? "opacity-100" : "opacity-0")} />
                    <span className="flex-1 truncate">{c.name}</span>
                    {badge && <Badge variant="secondary" className={cn("shrink-0", badge.className)}>{badge.label}</Badge>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
