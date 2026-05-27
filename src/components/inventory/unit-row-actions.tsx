"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { renameUnit } from "@/app/actions/units";

export function UnitRowActions({ code }: { code: string }) {
  const [editOpen, setEditOpen] = useState(false);
  const [newCode, setNewCode] = useState(code);
  const [pending, start] = useTransition();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => { setNewCode(code); setEditOpen(true); }}>
            Edit
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename unit</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="unit-code">Code</Label>
            <Input
              id="unit-code"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              maxLength={20}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              disabled={pending || !newCode.trim()}
              onClick={() =>
                start(async () => {
                  const res = await renameUnit(code, { code: newCode });
                  if (!res.ok) toast.error(res.error);
                  else { toast.success("Unit renamed"); setEditOpen(false); }
                })
              }
            >
              {pending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
