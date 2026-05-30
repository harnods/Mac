"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ActionResult } from "@/app/actions/employees";

type Props = {
  title: string;
  showSortOrder?: boolean;
  onCreate: (input: unknown) => Promise<ActionResult>;
};

export function AddMasterDataButton({ title, showSortOrder = false, onCreate }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [pending, start] = useTransition();

  function reset() {
    setName("");
    setSortOrder("0");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    start(async () => {
      const input: Record<string, unknown> = { name: name.trim() };
      if (showSortOrder) input.sort_order = Number(sortOrder);
      const res = await onCreate(input);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${title} created`);
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Add {title.toLowerCase()}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add {title.toLowerCase()}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mdata-name">Name</Label>
            <Input
              id="mdata-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          {showSortOrder && (
            <div className="space-y-2">
              <Label htmlFor="mdata-sort">Sort order</Label>
              <Input
                id="mdata-sort"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Saving..." : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
