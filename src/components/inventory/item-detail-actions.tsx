"use client";

import { useState } from "react";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { DetailActionsMenu } from "@/components/ui/detail-actions-menu";
import { ItemFormDialog } from "@/components/inventory/item-form-dialog";
import { ItemDeleteDialog } from "@/components/inventory/item-delete-dialog";
import type { ItemTypeSlug } from "@/lib/item-types";

export function ItemDetailActions({
  itemTypeSlug,
  itemId,
  name,
  backUrl,
}: {
  itemTypeSlug: ItemTypeSlug;
  itemId: string;
  name: string;
  backUrl: string;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DetailActionsMenu>
        <DropdownMenuItem onSelect={() => setEditOpen(true)}>Edit</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => setDeleteOpen(true)}
        >
          Delete
        </DropdownMenuItem>
      </DetailActionsMenu>

      <ItemFormDialog itemTypeSlug={itemTypeSlug} itemId={itemId} open={editOpen} onOpenChange={setEditOpen} />
      <ItemDeleteDialog id={itemId} name={name} open={deleteOpen} onOpenChange={setDeleteOpen} redirectAfter={backUrl} />
    </>
  );
}
