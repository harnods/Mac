"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SettingsNav() {
  const pathname = usePathname();
  const active =
    pathname.startsWith("/settings") ||
    pathname.startsWith("/inventory/categories") ||
    pathname.startsWith("/inventory/units") ||
    pathname.startsWith("/employees/departments") ||
    pathname.startsWith("/employees/job-positions") ||
    pathname.startsWith("/employees/job-levels") ||
    pathname.startsWith("/employees/employment-statuses");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "px-3 py-1.5 rounded-md hover:bg-accent flex items-center gap-1.5 outline-none data-[state=open]:bg-accent text-sm",
          active && "bg-accent/60",
        )}
      >
        <span>Settings</span>
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Categories</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/inventory/categories/ingredients" className="cursor-pointer">Ingredients</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/inventory/categories/supplies" className="cursor-pointer">Supplies</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/inventory/categories/products" className="cursor-pointer">Products</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/inventory/units" className="cursor-pointer">Units</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings/roles" className="cursor-pointer">Roles &amp; Permissions</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/tables" className="cursor-pointer">Meja &amp; QR Code</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/loyalty" className="cursor-pointer">Loyalty Points</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/employees/departments" className="cursor-pointer">Department</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/employees/job-positions" className="cursor-pointer">Job positions</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/employees/job-levels" className="cursor-pointer">Job levels</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/employees/employment-statuses" className="cursor-pointer">Employment status</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
