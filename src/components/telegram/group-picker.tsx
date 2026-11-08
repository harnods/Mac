"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type TelegramGroup = { chatId: number; title: string };

/** Pick one of the Telegram groups the bot has been added to (or none). */
export function GroupPicker({
  groups,
  value,
  onChange,
  disabled,
  className,
}: {
  groups: TelegramGroup[];
  value: number | null;
  onChange: (chatId: number | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = groups.find((g) => g.chatId === value) ?? null;
  // A saved group the bot has since left still shows, flagged.
  const missing = value != null && !selected;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className={cn("truncate", !selected && !missing && "text-muted-foreground")}>
            {selected ? selected.title : missing ? "Grup tidak tersedia (bot dikeluarkan?)" : "Select group"}
          </span>
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="" />
          <CommandList>
            <CommandEmpty>
              {groups.length === 0 ? "Belum ada grup. Tambahkan bot ke grup Telegram dulu." : "No groups found."}
            </CommandEmpty>
            <CommandGroup>
              {value != null && (
                <CommandItem value="__none__" onSelect={() => { onChange(null); setOpen(false); }} className="text-muted-foreground">
                  <span className="size-4" /> Tidak ada grup
                </CommandItem>
              )}
              {groups.map((g) => (
                <CommandItem
                  key={g.chatId}
                  value={`${g.title} ${g.chatId}`}
                  onSelect={() => { onChange(g.chatId); setOpen(false); }}
                >
                  <Check className={cn("size-4", value === g.chatId ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{g.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
