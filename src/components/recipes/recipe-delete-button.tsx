"use client";

import { useState } from "react";
import { RecipeDeleteDialog } from "./recipe-delete-dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function RecipeDeleteButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Delete
      </Button>
      <RecipeDeleteDialog
        id={id}
        name={name}
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) router.push("/recipes");
        }}
      />
    </>
  );
}
