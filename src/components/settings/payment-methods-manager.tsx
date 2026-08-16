"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, STICKY_ACTION_HEAD, STICKY_ACTION_CELL,
} from "@/components/ui/table";
import { createPaymentMethod, updatePaymentMethod, deletePaymentMethod } from "@/app/actions/payment-methods";

type Method = { id: string; name: string };

export function PaymentMethodsManager({ methods, canEdit }: { methods: Method[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [edit, setEdit] = useState<Method | null>(null);
  const [editName, setEditName] = useState("");
  const [del, setDel] = useState<Method | null>(null);

  function add() {
    start(async () => {
      const res = await createPaymentMethod({ name });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Payment method added");
      setName(""); setAddOpen(false); router.refresh();
    });
  }
  function save() {
    if (!edit) return;
    start(async () => {
      const res = await updatePaymentMethod(edit.id, { name: editName });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Renamed"); setEdit(null); router.refresh();
    });
  }
  function remove() {
    if (!del) return;
    start(async () => {
      const res = await deletePaymentMethod(del.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Deleted"); setDel(null); router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Payment methods</h1>
        {canEdit && (
          <Button onClick={() => { setName(""); setAddOpen(true); }}>
            <Plus className="size-4" /> Add payment method
          </Button>
        )}
      </div>

      {methods.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">No payment methods yet.</div>
      ) : (
        <div className="border table-outer rounded-lg overflow-x-auto">
          <Table className="w-auto min-w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[320px]">Name</TableHead>
                <TableHead className="w-0 p-0" />
                <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {methods.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell />
                  <TableCell className={STICKY_ACTION_CELL}>
                    {canEdit && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => { setEdit(m); setEditName(m.name); }}>Edit</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => setDel(m)}>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add payment method</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); add(); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pm-name">Name</Label>
              <Input id="pm-name" required value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. EDC Bank Mandiri, QRIS, Cash" />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
              <Button type="submit" disabled={pending || !name.trim()}>{pending ? "Adding..." : "Add"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename payment method</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pm-edit">Name</Label>
            <Input id="pm-edit" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={60} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={save} disabled={pending || !editName.trim()}>{pending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete “{del?.name}”?</DialogTitle>
            <DialogDescription>Existing sales entries keep their recorded payment names.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDel(null)}>Cancel</Button>
            <Button onClick={remove} disabled={pending}>{pending ? "Deleting..." : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
