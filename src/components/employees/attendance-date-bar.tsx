"use client";

import { useRef, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// "2026-06-25" -> parts
function parse(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { y, m: m - 1, d }; // m zero-based
}
function pad(n: number) {
  return String(n).padStart(2, "0");
}
function ymd(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function AttendanceDateBar({ selectedDate, today }: { selectedDate: string; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();
  const stripRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const sel = parse(selectedDate);
  const daysInMonth = new Date(sel.y, sel.m + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Month options: 12 months back through 1 month ahead of today.
  const t = parse(today);
  const monthOptions = Array.from({ length: 14 }, (_, i) => {
    const offset = i - 12; // -12 .. +1
    const date = new Date(t.y, t.m + offset, 1);
    return { y: date.getFullYear(), m: date.getMonth() };
  }).reverse();

  function pushDate(next: string) {
    const sp = new URLSearchParams(params.toString());
    sp.set("date", next);
    sp.delete("page");
    start(() => router.replace(`${pathname}?${sp.toString()}`, { scroll: false }));
  }

  function selectMonth(y: number, m: number) {
    // Keep today if navigating to the current month, else first of month.
    const target = y === t.y && m === t.m ? today : ymd(y, m, 1);
    pushDate(target);
  }

  // Scroll the selected day into view whenever it changes.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [selectedDate]);

  return (
    <div className="space-y-3">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1.5 text-lg font-semibold tracking-tight outline-none">
          {MONTH[sel.m]} {sel.y}
          <ChevronDown className="size-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
          {monthOptions.map(({ y, m }) => (
            <DropdownMenuItem
              key={`${y}-${m}`}
              onSelect={() => selectMonth(y, m)}
              className={cn(y === sel.y && m === sel.m && "font-semibold")}
            >
              {MONTH[m]} {y}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div ref={stripRef} className="flex gap-2 overflow-x-auto pb-1">
        {days.map((d) => {
          const dateStr = ymd(sel.y, sel.m, d);
          const weekday = new Date(sel.y, sel.m, d).getDay();
          const isWeekend = weekday === 0 || weekday === 6;
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === today;
          return (
            <button
              key={d}
              ref={isSelected ? activeRef : undefined}
              type="button"
              onClick={() => pushDate(dateStr)}
              className={cn(
                "flex min-w-[64px] shrink-0 flex-col items-center gap-1 rounded-lg px-3 py-2 text-center transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : cn(
                      "hover:bg-muted",
                      isWeekend ? "bg-muted/40" : "bg-muted/70",
                      isToday && "ring-1 ring-inset ring-foreground/40",
                    ),
              )}
            >
              <span className={cn("text-xs", !isSelected && "text-muted-foreground")}>{WEEKDAY[weekday]}</span>
              <span className="text-base font-semibold tabular-nums">{d}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
