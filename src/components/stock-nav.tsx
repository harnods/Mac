"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function StockNav() {
  const pathname = usePathname();
  const active = pathname.startsWith("/stock");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "px-3 py-1.5 rounded-md hover:bg-accent flex items-center gap-1.5 outline-none data-[state=open]:bg-accent text-sm",
          active && "bg-accent/60",
        )}
      >
        <span>Stock</span>
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/stock/adjustments" className="cursor-pointer">Manual adjustment</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href="/stock/counts" className="cursor-pointer">Stock count</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
