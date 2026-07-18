"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearAllData } from "@/app/actions/dev";

export function ClearDataDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState("");

  const CONFIRM_WORD = "DELETE";
  const confirmed = confirm === CONFIRM_WORD;

  function handleClose() {
    if (pending) return;
    setConfirm("");
    onOpenChange(false);
  }

  function handleClear() {
    if (!confirmed) return;
    start(async () => {
      const res = await clearAllData();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("All data cleared");
      setConfirm("");
      onOpenChange(false);
      router.push("/inventory");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="size-5" />
            Clear all data
          </DialogTitle>
          <DialogDescription className="text-sm pt-1">
            This will permanently delete all <strong>operational data</strong> —
            inventory, recipes, prep orders, purchases, sales, and stock
            movements. User accounts will not be affected.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            This action <strong>cannot be undone</strong>. All data will be permanently lost.
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-input">
              Type <strong>{CONFIRM_WORD}</strong> to confirm
            </Label>
            <Input
              id="confirm-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={pending}
              autoComplete="off"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={handleClose} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleClear}
              disabled={!confirmed || pending}
            >
              {pending ? "Clearing..." : "Clear all data"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
