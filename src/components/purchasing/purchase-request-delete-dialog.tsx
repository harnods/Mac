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
import { deletePurchaseRequest } from "@/app/actions/purchasing";

export function PurchaseRequestDeleteDialog({
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
      const res = await deletePurchaseRequest(id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Request deleted");
      onOpenChange(false);
      if (redirectAfter) router.push(redirectAfter);
      else router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete purchase request?</DialogTitle>
          <DialogDescription>
            This action cannot be undone.
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
