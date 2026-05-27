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

export function PurchasingNav() {
  const pathname = usePathname();
  const active = pathname.startsWith("/purchasing");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "px-3 py-1.5 rounded-md hover:bg-accent flex items-center gap-1.5 outline-none data-[state=open]:bg-accent text-sm",
          active && "bg-accent/60",
        )}
      >
        <span>Purchasing</span>
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
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
