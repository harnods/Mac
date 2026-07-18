"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteEmployee } from "@/app/actions/employees";

export function EmployeeDeleteDialog({
  id,
  name,
  open,
  onOpenChange,
  redirectAfter,
}: {
  id: string;
  name: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  redirectAfter?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function handleDelete() {
    start(async () => {
      const res = await deleteEmployee(id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Employee deleted");
      onOpenChange(false);
      if (redirectAfter) router.push(redirectAfter);
      else router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{name}&rdquo;?</DialogTitle>
          <DialogDescription>
            This employee will be removed from all lists. The record is soft-deleted
            and can be restored if needed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleDelete} disabled={pending}>
            {pending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
