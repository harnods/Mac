"use client";

import { useState } from "react";
import Link from "next/link";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { DetailActionsMenu } from "@/components/ui/detail-actions-menu";
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
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DetailActionsMenu>
        <DropdownMenuItem asChild>
          <Link href={`/inventory/${itemTypeSlug}/${itemId}/edit`}>Edit</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => setDeleteOpen(true)}
        >
          Delete
        </DropdownMenuItem>
      </DetailActionsMenu>

      <ItemDeleteDialog id={itemId} name={name} open={deleteOpen} onOpenChange={setDeleteOpen} redirectAfter={backUrl} />
    </>
  );
}
