"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell } from "@/components/ui/table";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { formatDate, updaterName } from "@/lib/format";
import { RecipeDeleteDialog } from "./recipe-delete-dialog";
import type { Updater } from "@/lib/supabase/types";

type Props = {
  id: string;
  name: string;
  product: string | null;
  productType: string | null;
  ingredientCount: number;
  updatedAt: string;
  updater: Updater | null;
  isAdmin: boolean;
};

export function RecipeTableRowClient({ id, name, product, productType, ingredientCount, updatedAt, updater, isAdmin }: Props) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  const typeLabel = productType === "prep_item" ? "WIP" : productType === "product" ? "Product" : null;

  return (
    <>
      <ClickableTableRow href={`/recipes/${id}`}>
        <TableCell className="font-medium truncate">{name}</TableCell>
        <TableCell className="text-sm">
          {typeLabel ?? <span className="text-muted-foreground">—</span>}
        </TableCell>
        <TableCell>{product ?? <span className="text-muted-foreground">—</span>}</TableCell>
        <TableCell className="tabular-nums">{ingredientCount}</TableCell>
        <TableCell>
          <div className="text-sm">{formatDate(updatedAt)}</div>
          <div className="text-xs text-muted-foreground">{updaterName(updater)}</div>
        </TableCell>
        <TableCell />
        <TableCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/recipes/${id}`}>View details</Link>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link href={`/recipes/${id}/edit`}>Edit</Link>
                </DropdownMenuItem>
              )}
              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setDeleteOpen(true)}>
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </ClickableTableRow>

      {isAdmin && (
        <RecipeDeleteDialog
          id={id}
          name={name}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      )}
    </>
  );
}
