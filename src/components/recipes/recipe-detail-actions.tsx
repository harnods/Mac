"use client";

import { useState } from "react";
import Link from "next/link";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { DetailActionsMenu } from "@/components/ui/detail-actions-menu";
import { RecipeDeleteDialog } from "@/components/recipes/recipe-delete-dialog";

export function RecipeDetailActions({ id, name }: { id: string; name: string }) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DetailActionsMenu>
        <DropdownMenuItem asChild>
          <Link href={`/recipes/${id}/edit`}>Edit</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => setDeleteOpen(true)}
        >
          Delete
        </DropdownMenuItem>
      </DetailActionsMenu>

      <RecipeDeleteDialog id={id} name={name} open={deleteOpen} onOpenChange={setDeleteOpen} redirectAfter="/recipes" />
    </>
  );
}
