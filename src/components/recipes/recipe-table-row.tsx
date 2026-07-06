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
import { TableCell, STICKY_ACTION_CELL } from "@/components/ui/table";
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
  isSelected?: boolean;
  onToggleSelect?: () => void;
  showType?: boolean;
  showOutput?: boolean;
  showIngredients?: boolean;
  showLastUpdated?: boolean;
};

export function RecipeTableRowClient({
  id, name, product, productType, ingredientCount, updatedAt, updater, isAdmin, isSelected = false, onToggleSelect,
  showType = true, showOutput = true, showIngredients = true, showLastUpdated = true,
}: Props) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  const typeLabel =
    productType === "wip"      ? "For prep item"
    : productType === "product"  ? "Product"
    : productType === "prep_item" ? "For prep item"      // legacy: inferred from item type
    : null;

  return (
    <>
      <ClickableTableRow href={`/recipes/${id}`} className={isSelected ? "bg-primary/5" : undefined}>
        {onToggleSelect && (
          <TableCell className="w-10 px-0" onClick={(e) => e.stopPropagation()}>
            <label className="flex items-center justify-center w-full py-3 cursor-pointer">
              <input type="checkbox" checked={isSelected} onChange={onToggleSelect} className="size-4 cursor-pointer" />
            </label>
          </TableCell>
        )}
        <TableCell className="font-medium truncate">{name}</TableCell>
        {showType && (
          <TableCell className="text-sm">
            {typeLabel ?? <span className="text-muted-foreground">—</span>}
          </TableCell>
        )}
        {showOutput && <TableCell>{product ?? <span className="text-muted-foreground">—</span>}</TableCell>}
        {showIngredients && <TableCell className="tabular-nums">{ingredientCount}</TableCell>}
        {showLastUpdated && (
          <TableCell>
            <div className="text-sm">{formatDate(updatedAt)}</div>
            <div className="text-xs text-muted-foreground">{updaterName(updater)}</div>
          </TableCell>
        )}
        <TableCell />
        <TableCell className={STICKY_ACTION_CELL}>
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
