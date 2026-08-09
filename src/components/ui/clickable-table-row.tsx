"use client";

import { useRouter } from "next/navigation";
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef } from "react";

type Props = ComponentPropsWithoutRef<typeof TableRow> & { href: string };

export function ClickableTableRow({ href, className, children, ...props }: Props) {
  const router = useRouter();
  return (
    <TableRow
      onDoubleClick={() => router.push(href)}
      className={cn("cursor-pointer hover:bg-muted/50", className)}
      {...props}
    >
      {children}
    </TableRow>
  );
}
