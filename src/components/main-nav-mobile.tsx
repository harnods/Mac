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

export function MainNavMobile() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open navigation menu"
        className="p-2 rounded-md hover:bg-accent flex items-center outline-none data-[state=open]:bg-accent"
      >
        <Menu className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Inventory</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/inventory/ingredients" className="cursor-pointer">Ingredients</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/inventory/supplies" className="cursor-pointer">Supplies</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/inventory/products" className="cursor-pointer">Products</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/inventory/prep-items" className="cursor-pointer">Prep items</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/inventory/categories/ingredients" className="cursor-pointer">Ingredients categories</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/inventory/categories/products" className="cursor-pointer">Product categories</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/inventory/categories/supplies" className="cursor-pointer">Supply categories</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/inventory/units" className="cursor-pointer">Units</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Recipes</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/recipes" className="cursor-pointer">Recipes</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Prep orders</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/prep-orders" className="cursor-pointer">Prep orders</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Sales</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/sales" className="cursor-pointer">Sales</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Stock</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/stock/adjustments" className="cursor-pointer">Manual adjustment</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/stock/counts" className="cursor-pointer">Stock count</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Employees</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/employees" className="cursor-pointer">All employees</Link>
        </DropdownMenuItem>
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
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Purchasing</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/purchasing/requests" className="cursor-pointer">Purchase Requests</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/purchasing/purchases" className="cursor-pointer">Purchases</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
