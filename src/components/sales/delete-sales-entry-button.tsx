"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SalesEntryDeleteDialog } from "./sales-entry-delete-dialog";

export function DeleteSalesEntryButtonClient({ id }: { id: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Delete
      </Button>
      <SalesEntryDeleteDialog
        id={id}
        open={open}
        onOpenChange={setOpen}
        redirectAfter="/sales"
      />
    </>
  );
}
