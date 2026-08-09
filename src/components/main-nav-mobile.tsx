"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function MainNavMobile({ canHr = true }: { canHr?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open navigation menu"
        className="p-2 rounded-md hover:bg-accent flex items-center outline-none data-[state=open]:bg-accent"
      >
        <Menu className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Orders</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/orders" className="cursor-pointer">POS</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Pipeline</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/orders/bar" className="cursor-pointer">Bar</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/orders/kitchen" className="cursor-pointer">Kitchen</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/orders/settings" className="cursor-pointer">Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Inventory</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/inventory/ingredients" className="cursor-pointer">Ingredients</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/inventory/supplies" className="cursor-pointer">Supplies</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/inventory/products" className="cursor-pointer">Products</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/inventory/prep-items" className="cursor-pointer">Prep items</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/stock/adjustments" className="cursor-pointer">Stock adjustment</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/stock/counts" className="cursor-pointer">Stock count</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/settings/categories/ingredients" className="cursor-pointer">Ingredients categories</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/settings/categories/supplies" className="cursor-pointer">Supplies categories</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/settings/categories/products" className="cursor-pointer">Products categories</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/settings/units" className="cursor-pointer">Units</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Recipes</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/recipes" className="cursor-pointer">Recipes</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Prep orders</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/prep-orders" className="cursor-pointer">Prep orders</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Purchasing</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/purchasing/requests" className="cursor-pointer">Purchase requests</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/purchasing/purchases" className="cursor-pointer">Purchases</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Settings</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/settings/categories/ingredients" className="cursor-pointer">Ingredients categories</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/settings/categories/supplies" className="cursor-pointer">Supplies categories</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/settings/categories/products" className="cursor-pointer">Products categories</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/settings/units" className="cursor-pointer">Units</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/settings/roles" className="cursor-pointer">Roles &amp; permissions</Link>
        </DropdownMenuItem>
        {canHr && (<>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>HR</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/hr/crew" className="cursor-pointer">Crew</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/hr/attendance" className="cursor-pointer">Attendance</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/hr/overtime" className="cursor-pointer">Overtime</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/hr/time-off" className="cursor-pointer">Time off</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/hr/payroll" className="cursor-pointer">Payroll</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/hr/job-positions" className="cursor-pointer">Job positions</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/hr/job-levels" className="cursor-pointer">Job levels</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/hr/employment-statuses" className="cursor-pointer">Employment type</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/hr/departments" className="cursor-pointer">Departments</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/hr/shifts" className="cursor-pointer">Shifts</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/hr/overtime-settings" className="cursor-pointer">Overtime</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/hr/payroll-settings" className="cursor-pointer">Payroll</Link>
        </DropdownMenuItem>
        </>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
