"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, CalendarDays, Timer, Wallet, User } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/me", label: "Attendance", icon: CalendarClock, match: (p: string) => p === "/me" || p.startsWith("/me/attendance") },
  { href: "/me/schedule", label: "Schedule", icon: CalendarDays, match: (p: string) => p.startsWith("/me/schedule") },
  { href: "/me/overtime", label: "Overtime", icon: Timer, match: (p: string) => p.startsWith("/me/overtime") },
  { href: "/me/payslip", label: "Payslip", icon: Wallet, match: (p: string) => p.startsWith("/me/payslip") },
  { href: "/me/profile", label: "Profile", icon: User, match: (p: string) => p.startsWith("/me/profile") },
];

export function CrewNav() {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 z-10 grid grid-cols-5 border-t bg-background/95 pb-10 backdrop-blur">
      {TABS.map((t) => {
        const active = t.match(pathname);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors",
              active ? "text-primary font-medium" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
