"use client";

import Link from "next/link";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * "Rows per page" picker. Kept as a client component: rendering the Radix
 * dropdown directly from the (server) PaginationBar left the trigger out of
 * the SSR HTML, causing a hydration mismatch on every paginated list.
 */
export function PageSizeMenu({
  pageSize,
  options,
}: {
  pageSize: number;
  options: { size: number; href: string }[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="tabular-nums">
          {pageSize} <ChevronsUpDown className="size-3.5 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[4rem]">
        {options.map((o) => (
          <DropdownMenuItem key={o.size} asChild>
            <Link href={o.href} className="tabular-nums cursor-pointer">
              {o.size}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
