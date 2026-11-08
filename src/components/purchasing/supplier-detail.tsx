"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, MessageCircle, MoreHorizontal, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, STICKY_ACTION_HEAD, STICKY_ACTION_CELL,
} from "@/components/ui/table";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { DetailActionsMenu } from "@/components/ui/detail-actions-menu";
import { DetailBackButton } from "@/components/employees/detail-back-button";
import { SupplierFormDialog, SupplierDeleteDialog } from "@/components/purchasing/supplier-dialogs";
import { addItemSuppliers, removeItemSupplier, setPrimaryItemSupplier } from "@/app/actions/item-suppliers";
import { formatDate } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import type { SupplierWithPics } from "@/lib/supabase/types";

export type SupplierIngredientRow = {
  itemId: string;
  name: string;
  categoryName: string | null;
  isPrimary: boolean;
  /** Name of the ingredient's primary supplier (this one or another). */
  primarySupplierName: string | null;
  updatedAt: string;
  updaterLabel: string | null;
};

type IngredientOption = { id: string; name: string; categoryName: string | null };

export function SupplierDetail({
  supplier,
  ingredients,
  ingredientOptions,
  canEditSupplier,
  canEditIngredients,
}: {
  supplier: SupplierWithPics;
  ingredients: SupplierIngredientRow[];
  ingredientOptions: IngredientOption[];
  canEditSupplier: boolean;
  canEditIngredients: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [removing, setRemoving] = useState<SupplierIngredientRow | null>(null);
  const [q, setQ] = useState("");

  const filtered = ingredients.filter((r) => {
    const term = q.trim().toLowerCase();
    return !term || r.name.toLowerCase().includes(term) || (r.categoryName ?? "").toLowerCase().includes(term);
  });

  function makePrimary(row: SupplierIngredientRow) {
    start(async () => {
      const res = await setPrimaryItemSupplier(row.itemId, supplier.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${supplier.name} is now the primary supplier for ${row.name}`);
      router.refresh();
    });
  }

  function remove() {
    if (!removing) return;
    start(async () => {
      const res = await removeItemSupplier(removing.itemId, supplier.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${removing.name} removed`);
      setRemoving(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <DetailBackButton href="/purchasing/suppliers" />
          <h1 className="text-2xl font-semibold tracking-tight">{supplier.name}</h1>
        </div>
        {canEditSupplier && (
          <DetailActionsMenu>
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>Edit</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setDeleteOpen(true)}>Delete</DropdownMenuItem>
          </DetailActionsMenu>
        )}
      </div>

      <div className="space-y-2 max-w-2xl">
        <h2 className="text-sm font-medium">PIC</h2>
        {supplier.supplier_pics.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <ul className="space-y-1">
            {supplier.supplier_pics.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-2 text-sm">
                <span>{p.name}</span>
                {p.whatsapp && (
                  <a
                    href={waLink(p.whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline tabular-nums"
                  >
                    <MessageCircle className="size-3" /> {p.whatsapp}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">
            Ingredients <span className="text-muted-foreground tabular-nums">({ingredients.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search ingredients"
              className="w-64"
            />
            {canEditIngredients && (
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="size-4" /> Add ingredients
              </Button>
            )}
          </div>
        </div>

        {ingredients.length === 0 ? (
          <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
            No ingredients linked to this supplier yet.
          </div>
        ) : filtered.length === 0 ? (
          <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
            No ingredients match your search.
          </div>
        ) : (
          <div className="border table-outer rounded-lg overflow-x-auto">
            <Table className="w-auto min-w-full table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-64">Ingredient</TableHead>
                  <TableHead className="w-40">Category</TableHead>
                  <TableHead className="w-56">Primary supplier</TableHead>
                  <TableHead className="w-44">Last updated</TableHead>
                  <TableHead className="w-0 p-0" />
                  <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <ClickableTableRow key={r.itemId} href={`/inventory/ingredients/${r.itemId}`}>
                    <TableCell>
                      <Link href={`/inventory/ingredients/${r.itemId}`} className="font-medium hover:underline">
                        {r.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{r.categoryName ?? "Uncategorized"}</TableCell>
                    <TableCell>
                      {r.isPrimary ? (
                        <Badge variant="secondary">Primary</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">{r.primarySupplierName ?? "—"}</span>
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
                            <Link href={`/inventory/ingredients/${r.itemId}`}>View ingredient</Link>
                          </DropdownMenuItem>
                          {canEditIngredients && !r.isPrimary && (
                            <DropdownMenuItem disabled={pending} onSelect={() => makePrimary(r)}>
                              Set as primary
                            </DropdownMenuItem>
                          )}
                          {canEditIngredients && (
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
      </div>

      {canEditSupplier && (
        <>
          <SupplierFormDialog open={editOpen} onOpenChange={setEditOpen} supplier={supplier} />
          <SupplierDeleteDialog
            supplier={supplier}
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            redirectAfter="/purchasing/suppliers"
          />
        </>
      )}

      {canEditIngredients && (
        <AddIngredientsDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          supplierId={supplier.id}
          options={ingredientOptions.filter((o) => !ingredients.some((r) => r.itemId === o.id))}
        />
      )}

      <Dialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove {removing?.name}?</DialogTitle>
            <DialogDescription>
              {removing?.isPrimary
                ? `${supplier.name} is the primary supplier for this ingredient. Its next supplier (if any) will become primary.`
                : `${removing?.name} will no longer be linked to ${supplier.name}.`}
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

/** Multi-select ingredients to link to this supplier (add only). */
function AddIngredientsDialog({
  open,
  onOpenChange,
  supplierId,
  options,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId: string;
  options: IngredientOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    start(async () => {
      const res = await addItemSuppliers({ itemIds: [...picked], supplierIds: [supplierId] });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${res.added ?? picked.size} ingredient${(res.added ?? picked.size) === 1 ? "" : "s"} added`);
      setPicked(new Set());
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setPicked(new Set()); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add ingredients</DialogTitle>
          <DialogDescription>
            Ingredients without a supplier yet will get this supplier as their primary.
          </DialogDescription>
        </DialogHeader>
        <Command className="border rounded-md">
          <CommandInput placeholder="Search ingredients" />
          <CommandList className="max-h-72">
            <CommandEmpty>
              {options.length === 0 ? "All ingredients are already linked." : "No ingredients found."}
            </CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o.id} value={`${o.name} ${o.categoryName ?? ""} ${o.id}`} onSelect={() => toggle(o.id)}>
                  <Check className={cn("size-4", picked.has(o.id) ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate">{o.name}</span>
                  {o.categoryName && <span className="text-xs text-muted-foreground">{o.categoryName}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
          <Button onClick={submit} disabled={pending || picked.size === 0}>
            {pending
              ? "Adding…"
              : picked.size === 0
                ? "Add ingredients"
                : `Add ${picked.size} ingredient${picked.size === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
