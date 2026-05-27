"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
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
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { updateCategory, deleteCategory } from "@/app/actions/inventory";
import { formatDate, updaterName } from "@/lib/format";
import type { CategoryWithUpdater } from "@/lib/supabase/types";

type ModalState =
  | { type: "edit"; category: CategoryWithUpdater }
  | { type: "delete"; category: CategoryWithUpdater }
  | null;

export function CategoryManager({
  categories,
  isAdmin,
}: {
  categories: CategoryWithUpdater[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [modal, setModal] = useState<ModalState>(null);
  const [editName, setEditName] = useState("");

  function openEdit(c: CategoryWithUpdater) {
    setEditName(c.name);
    setModal({ type: "edit", category: c });
  }

  function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!modal || modal.type !== "edit") return;
    start(async () => {
      const res = await updateCategory(modal.category.id, { name: editName });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Category updated");
      setModal(null);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!modal || modal.type !== "delete") return;
    start(async () => {
      const res = await deleteCategory(modal.category.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Category deleted");
      setModal(null);
      router.refresh();
    });
  }

  if (categories.length === 0) {
    return (
      <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
        No categories found.
      </div>
    );
  }

  return (
    <>
      <div className="border table-outer rounded-lg overflow-hidden">
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-52">Name</TableHead>
              <TableHead className="w-48">Last updated</TableHead>
              <TableHead></TableHead>
              {isAdmin && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium truncate">{c.name}</TableCell>
                <TableCell>
                  {c.is_default ? (
                    <span className="text-muted-foreground text-sm">—</span>
                  ) : (
                    <>
                      <div className="text-sm">{formatDate(c.updated_at)}</div>
                      <div className="text-xs text-muted-foreground">{updaterName(c.updater)}</div>
                    </>
                  )}
                </TableCell>
                <TableCell />
                {isAdmin && (
                  <TableCell>
                    {!c.is_default && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => openEdit(c)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setModal({ type: "delete", category: c })}>
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit modal */}
      <Dialog
        open={modal?.type === "edit"}
        onOpenChange={(o) => !o && setModal(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit category</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={pending || !editName.trim()}>
                {pending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm modal */}
      <Dialog
        open={modal?.type === "delete"}
        onOpenChange={(o) => !o && setModal(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{modal?.type === "delete" ? modal.category.name : ""}"?</DialogTitle>
            <DialogDescription>
              Items in this category will become uncategorized.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button disabled={pending} onClick={handleDelete}>
              {pending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
