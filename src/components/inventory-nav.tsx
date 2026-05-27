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

export function InventoryNav() {
  const pathname = usePathname();
  const active =
    pathname.startsWith("/inventory") ||
    pathname.startsWith("/categories");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "px-3 py-1.5 rounded-md hover:bg-accent flex items-center gap-1.5 outline-none data-[state=open]:bg-accent",
          active && "bg-accent/60",
        )}
      >
        <span>Inventory</span>
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
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
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/inventory/categories/ingredients" className="cursor-pointer">Ingredients categories</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/inventory/categories/products" className="cursor-pointer">Product categories</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/inventory/categories/supplies" className="cursor-pointer">Supply categories</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/inventory/units" className="cursor-pointer">Units</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
