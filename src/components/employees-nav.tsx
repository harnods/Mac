"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function EmployeesNav() {
  const pathname = usePathname();
  const active = pathname.startsWith("/employees");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "px-3 py-1.5 rounded-md hover:bg-accent flex items-center gap-1.5 outline-none data-[state=open]:bg-accent text-sm",
          active && "bg-accent/60",
        )}
      >
        <span>Employees</span>
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuItem asChild>
          <Link href="/employees" className="cursor-pointer">All employees</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/employees/departments" className="cursor-pointer">Departments</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/employees/job-positions" className="cursor-pointer">Job positions</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/employees/employment-statuses" className="cursor-pointer">Employment statuses</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/employees/job-levels" className="cursor-pointer">Job levels</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
