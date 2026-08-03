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
  STICKY_ACTION_HEAD,
  STICKY_ACTION_CELL,
} from "@/components/ui/table";
import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { formatDate, updaterName } from "@/lib/format";
import type { Updater } from "@/lib/supabase/types";
import type { ActionResult } from "@/app/actions/employees";

export function masterDataTableId(title: string) {
  return `master-data-${title.toLowerCase().replace(/\s+/g, "-")}`;
}

export function getMasterDataColumns(showSortOrder: boolean): ColumnDef[] {
  return [
    ...(showSortOrder ? [{ key: "sortOrder", label: "Sort order" }] : []),
    { key: "lastUpdated", label: "Last updated", defaultHidden: true },
  ];
}

type Item = {
  id: string;
  name: string;
  sort_order?: number;
  updated_at?: string;
  updater?: Updater | null;
};

type ModalState =
  | { type: "edit"; item: Item }
  | { type: "delete"; item: Item }
  | null;

type Props = {
  title: string;
  items: Item[];
  isAdmin: boolean;
  showSortOrder?: boolean;
  onUpdate: (id: string, input: unknown) => Promise<ActionResult>;
  onDelete: (id: string) => Promise<ActionResult>;
};

export function MasterDataManager({
  title,
  items,
  isAdmin,
  showSortOrder = false,
  onUpdate,
  onDelete,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [modal, setModal] = useState<ModalState>(null);
  const [editName, setEditName] = useState("");
  const [editSortOrder, setEditSortOrder] = useState("0");
  const columns = getMasterDataColumns(showSortOrder);
  const { isVisible } = useColumnVisibility(masterDataTableId(title), columns);

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

  const colCount = 1 + (showSortOrder && isVisible("sortOrder") ? 1 : 0) + (isVisible("lastUpdated") ? 1 : 0) + (isAdmin ? 1 : 0);

  return (
    <>
      <div className="border table-outer rounded-lg overflow-x-auto">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              {showSortOrder && isVisible("sortOrder") && <TableHead className="w-28">Sort order</TableHead>}
              {isVisible("lastUpdated") && <TableHead className="w-44">Last updated</TableHead>}
              {isAdmin && <TableHead />}
              {isAdmin && <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={colCount}
                  className="text-center text-sm text-muted-foreground py-8"
                >
                  No {title.toLowerCase()} yet.
                </TableCell>
              </TableRow>
            )}
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium truncate">{item.name}</TableCell>
                {showSortOrder && isVisible("sortOrder") && (
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {item.sort_order ?? 0}
                  </TableCell>
                )}
                {isVisible("lastUpdated") && (
                <TableCell>
                  {item.updated_at && (
                    <>
                      <div className="text-sm">{formatDate(item.updated_at)}</div>
                      <div className="text-xs text-muted-foreground">{updaterName(item.updater ?? null)}</div>
                    </>
                  )}
                </TableCell>
                )}
                {isAdmin && <TableCell />}
                {isAdmin && (
                  <TableCell className={STICKY_ACTION_CELL}>
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

          </TableBody>
        </Table>
      </div>

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
