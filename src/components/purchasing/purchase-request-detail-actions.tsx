"use client";

import { useState } from "react";
import Link from "next/link";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { DetailActionsMenu } from "@/components/ui/detail-actions-menu";
import { PurchaseRequestDeleteDialog } from "@/components/purchasing/purchase-request-delete-dialog";

export function PurchaseRequestDetailActions({
  id,
  canEdit,
  canDelete,
}: {
  id: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!canEdit && !canDelete) return null;

  return (
    <>
      <DetailActionsMenu>
        {canEdit && (
          <DropdownMenuItem asChild>
            <Link href={`/purchasing/requests/${id}/edit`}>Edit</Link>
          </DropdownMenuItem>
        )}
        {canDelete && (
          <>
            {canEdit && <DropdownMenuSeparator />}
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => setDeleteOpen(true)}
            >
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DetailActionsMenu>

      <PurchaseRequestDeleteDialog id={id} open={deleteOpen} onOpenChange={setDeleteOpen} redirectAfter="/purchasing/requests" />
    </>
  );
}
