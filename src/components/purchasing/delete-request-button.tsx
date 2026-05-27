"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PurchaseRequestDeleteDialog } from "./purchase-request-delete-dialog";

export function DeleteRequestButtonClient({ id }: { id: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Delete
      </Button>
      <PurchaseRequestDeleteDialog
        id={id}
        open={open}
        onOpenChange={setOpen}
        redirectAfter="/purchasing/requests"
      />
    </>
  );
}
