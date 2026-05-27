"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { cancelPrepOrder } from "@/app/actions/prep-orders";

export function CancelPrepButton({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function handleCancel() {
    start(async () => {
      const res = await cancelPrepOrder(id);
      if (!res.ok) {
        toast.error(res.error);
      } else {
        toast.success("Prep order cancelled");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Cancel order
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel prep order?</DialogTitle>
            <DialogDescription>
              The prep order will be cancelled. No stock changes will be made.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Back
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={pending}>
              {pending ? "Cancelling..." : "Yes, cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
