"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export function SettingsNav() {
  const pathname = usePathname();
  const active = pathname.startsWith("/settings");

  return (
    <Link
      href="/settings/roles"
      className={cn(
        "px-3 py-1.5 rounded-md hover:bg-accent flex items-center gap-1.5 text-sm",
        active && "bg-accent/60",
      )}
    >
      <Settings className="size-3.5 opacity-60" />
      <span>Settings</span>
    </Link>
  );
}
