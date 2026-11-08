"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageCircle, MoreHorizontal, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, STICKY_ACTION_HEAD, STICKY_ACTION_CELL,
} from "@/components/ui/table";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { AddSupplierDialog, type SupplierOption } from "@/components/purchasing/add-supplier-dialog";
import { removeItemSupplier, setPrimaryItemSupplier } from "@/app/actions/item-suppliers";
import { formatDate } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";

export type ItemSupplierRow = {
  supplierId: string;
  name: string;
  isPrimary: boolean;
  pic: { name: string; whatsapp: string | null } | null;
  updatedAt: string;
  updaterLabel: string | null;
};

/** "Suppliers" tab on the ingredient detail page. */
export function ItemSuppliersPanel({
  itemId,
  rows,
  suppliers,
  canEdit,
}: {
  itemId: string;
  rows: ItemSupplierRow[];
  /** All suppliers, for the "Add supplier" picker. */
  suppliers: SupplierOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [removing, setRemoving] = useState<ItemSupplierRow | null>(null);

  const filtered = rows.filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase()));

  function makePrimary(row: ItemSupplierRow) {
    start(async () => {
      const res = await setPrimaryItemSupplier(itemId, row.supplierId);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${row.name} is now the primary supplier`);
      router.refresh();
    });
  }

  function remove() {
    if (!removing) return;
    start(async () => {
      const res = await removeItemSupplier(itemId, removing.supplierId);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${removing.name} removed`);
      setRemoving(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search suppliers"
          className="max-w-xs"
        />
        {canEdit && (
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="size-4" /> Add supplier
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
          No suppliers yet.
        </div>
      ) : filtered.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
          No suppliers match your search.
        </div>
      ) : (
        <div className="border table-outer rounded-lg overflow-x-auto">
          <Table className="w-auto min-w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-64">Supplier</TableHead>
                <TableHead className="w-56">PIC</TableHead>
                <TableHead className="w-44">Last updated</TableHead>
                <TableHead className="w-0 p-0" />
                <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <ClickableTableRow key={r.supplierId} href={`/purchasing/suppliers/${r.supplierId}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link href={`/purchasing/suppliers/${r.supplierId}`} className="font-medium hover:underline truncate">
                        {r.name}
                      </Link>
                      {r.isPrimary && <Badge variant="secondary">Primary</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {r.pic ? (
                      <div className="text-sm">
                        <div className="truncate">{r.pic.name}</div>
                        {r.pic.whatsapp && (
                          <a
                            href={waLink(r.pic.whatsapp)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline tabular-nums"
                          >
                            <MessageCircle className="size-3" /> {r.pic.whatsapp}
                          </a>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{formatDate(r.updatedAt)}</div>
                    {r.updaterLabel && <div className="text-xs text-muted-foreground">{r.updaterLabel}</div>}
                  </TableCell>
                  <TableCell />
                  <TableCell className={STICKY_ACTION_CELL}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/purchasing/suppliers/${r.supplierId}`}>View supplier</Link>
                        </DropdownMenuItem>
                        {canEdit && !r.isPrimary && (
                          <DropdownMenuItem disabled={pending} onSelect={() => makePrimary(r)}>
                            Set as primary
                          </DropdownMenuItem>
                        )}
                        {canEdit && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => setRemoving(r)}>Remove</DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </ClickableTableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {canEdit && (
        <AddSupplierDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          itemIds={[itemId]}
          suppliers={suppliers}
          excludeSupplierIds={rows.map((r) => r.supplierId)}
          allowPrimary={rows.length > 0}
        />
      )}

      <Dialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove {removing?.name}?</DialogTitle>
            <DialogDescription>
              {removing?.isPrimary && rows.length > 1
                ? "This is the primary supplier. The next supplier will become primary."
                : "This ingredient will no longer be linked to this supplier."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button onClick={remove} disabled={pending}>{pending ? "Removing…" : "Remove"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
