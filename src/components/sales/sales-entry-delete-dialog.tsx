"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { deleteSalesEntry } from "@/app/actions/sales";

export function SalesEntryDeleteDialog({
  id,
  open,
  onOpenChange,
  redirectAfter,
}: {
  id: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  redirectAfter?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function handleDelete() {
    start(async () => {
      const res = await deleteSalesEntry(id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Sales entry deleted, stock restored");
      onOpenChange(false);
      if (redirectAfter) router.push(redirectAfter);
      else router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete sales entry?</DialogTitle>
          <DialogDescription>
            The stock consumed by this entry will be restored. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button onClick={handleDelete} disabled={pending}>
            {pending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
