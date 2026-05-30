"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { ImportItemsDialog } from "./import-items-dialog";
import type { ItemTypeSlug } from "@/lib/item-types";

export function ImportItemsButton({ itemTypeSlug }: { itemTypeSlug: ItemTypeSlug }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="size-4" />
        Import
      </Button>
      <ImportItemsDialog
        itemTypeSlug={itemTypeSlug}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
