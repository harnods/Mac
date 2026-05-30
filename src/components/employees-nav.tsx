"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function EmployeesNav() {
  const pathname = usePathname();
  const active = pathname.startsWith("/employees");

  return (
    <Link
      href="/employees"
      className={cn(
        "px-3 py-1.5 rounded-md hover:bg-accent flex items-center gap-1.5 text-sm",
        active && "bg-accent/60",
      )}
    >
      <span>Employees</span>
    </Link>
  );
}
