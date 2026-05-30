"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Plus } from "lucide-react";
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
import type { ActionResult } from "@/app/actions/employees";

type Item = { id: string; name: string; sort_order?: number };

type ModalState =
  | { type: "edit"; item: Item }
  | { type: "delete"; item: Item }
  | null;

type Props = {
  title: string;
  items: Item[];
  isAdmin: boolean;
  showSortOrder?: boolean;
  onCreate: (input: unknown) => Promise<ActionResult>;
  onUpdate: (id: string, input: unknown) => Promise<ActionResult>;
  onDelete: (id: string) => Promise<ActionResult>;
};

export function MasterDataManager({
  title,
  items,
  isAdmin,
  showSortOrder = false,
  onCreate,
  onUpdate,
  onDelete,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [modal, setModal] = useState<ModalState>(null);
  const [editName, setEditName] = useState("");
  const [editSortOrder, setEditSortOrder] = useState("0");
  const [addName, setAddName] = useState("");
  const [addSortOrder, setAddSortOrder] = useState("0");
  const [adding, setAdding] = useState(false);

  function openEdit(item: Item) {
    setEditName(item.name);
    setEditSortOrder(String(item.sort_order ?? 0));
    setModal({ type: "edit", item });
  }

  function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!modal || modal.type !== "edit") return;
    start(async () => {
      const input: Record<string, unknown> = { name: editName };
      if (showSortOrder) input.sort_order = Number(editSortOrder);
      const res = await onUpdate(modal.item.id, input);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${title} updated`);
      setModal(null);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!modal || modal.type !== "delete") return;
    start(async () => {
      const res = await onDelete(modal.item.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${title} deleted`);
      setModal(null);
      router.refresh();
    });
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addName.trim()) return;
    start(async () => {
      const input: Record<string, unknown> = { name: addName.trim() };
      if (showSortOrder) input.sort_order = Number(addSortOrder);
      const res = await onCreate(input);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${title} created`);
      setAddName("");
      setAddSortOrder("0");
      setAdding(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="border table-outer rounded-lg overflow-x-auto">
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              {showSortOrder && <TableHead className="w-28">Sort order</TableHead>}
              {isAdmin && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? (showSortOrder ? 3 : 2) : (showSortOrder ? 2 : 1)}
                  className="text-center text-sm text-muted-foreground py-8"
                >
                  No {title.toLowerCase()} yet.
                </TableCell>
              </TableRow>
            )}
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium truncate">{item.name}</TableCell>
                {showSortOrder && (
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {item.sort_order ?? 0}
                  </TableCell>
                )}
                {isAdmin && (
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => openEdit(item)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setModal({ type: "delete", item })}>
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))}

            {/* Inline add row */}
            {isAdmin && adding && (
              <TableRow>
                <TableCell colSpan={showSortOrder ? 2 : 1}>
                  <form onSubmit={handleAdd} className="flex items-center gap-2">
                    <Input
                      autoFocus
                      placeholder="Name"
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                      className="h-8"
                    />
                    {showSortOrder && (
                      <Input
                        type="number"
                        placeholder="Order"
                        value={addSortOrder}
                        onChange={(e) => setAddSortOrder(e.target.value)}
                        className="h-8 w-20"
                      />
                    )}
                    <Button type="submit" size="sm" disabled={pending || !addName.trim()}>
                      {pending ? "..." : "Add"}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(false); setAddName(""); setAddSortOrder("0"); }}>
                      Cancel
                    </Button>
                  </form>
                </TableCell>
                {isAdmin && <TableCell />}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {isAdmin && !adding && (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="mt-3">
          <Plus className="size-4 mr-1" /> Add {title.toLowerCase()}
        </Button>
      )}

      {/* Edit modal */}
      <Dialog open={modal?.type === "edit"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit {title.toLowerCase()}</DialogTitle>
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
            {showSortOrder && (
              <div className="space-y-2">
                <Label htmlFor="edit-sort">Sort order</Label>
                <Input
                  id="edit-sort"
                  type="number"
                  value={editSortOrder}
                  onChange={(e) => setEditSortOrder(e.target.value)}
                />
              </div>
            )}
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
      <Dialog open={modal?.type === "delete"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{modal?.type === "delete" ? modal.item.name : ""}&rdquo;?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Deletion will fail if this {title.toLowerCase()} is currently used by an employee.
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
