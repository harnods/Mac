"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import type { ItemTypeSlug } from "@/lib/item-types";

// Lazy-load the dialog (and its heavy `xlsx` dependency) only when the user
// actually opens Import — keeps it out of every inventory page's JS bundle.
const ImportItemsDialog = dynamic(
  () => import("./import-items-dialog").then((m) => m.ImportItemsDialog),
  { ssr: false },
);

export function ImportItemsButton({ itemTypeSlug }: { itemTypeSlug: ItemTypeSlug }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="size-4" />
        Import
      </Button>
      {open && (
        <ImportItemsDialog
          itemTypeSlug={itemTypeSlug}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
