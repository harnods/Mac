"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { ItemTableRow } from "./item-table-row";
import { bulkDeleteItems, bulkUpdateItems } from "@/app/actions/inventory";
import type { ItemWithCategory } from "@/lib/supabase/types";
import type { ItemTypeSlug, StockMode } from "@/lib/item-types";

type Category = { id: string; name: string };

type Props = {
  items: ItemWithCategory[];
  categories: Category[];
  isAdmin: boolean;
  itemTypeSlug: ItemTypeSlug;
  showCategory: boolean;
  stockMode: StockMode;
  showCost: boolean;
  linkedRecipeProductIds?: Set<string>;
};

const NONE = "__none__";

export function ItemBulkTable({
  items, categories, isAdmin, itemTypeSlug, showCategory, stockMode, showCost, linkedRecipeProductIds,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const allIds = items.map((i) => i.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleBulkDelete() {
    startTransition(async () => {
      const res = await bulkDeleteItems([...selected]);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${selected.size} item${selected.size !== 1 ? "s" : ""} deleted`);
      setSelected(new Set());
      setDeleteOpen(false);
      router.refresh();
    });
  }

  function handleBulkEdit() {
    const patch: Record<string, unknown> = {};
    if (editCategoryId === NONE) patch.category_id = null;
    else if (editCategoryId) patch.category_id = editCategoryId;
    if (!Object.keys(patch).length) { toast.error("Nothing to change"); return; }

    startTransition(async () => {
      const res = await bulkUpdateItems([...selected], patch);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${selected.size} item${selected.size !== 1 ? "s" : ""} updated`);
      setSelected(new Set());
      setEditOpen(false);
      setEditCategoryId("");
      router.refresh();
    });
  }

  return (
    <>
      {/* Action bar */}
      {someSelected && isAdmin && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border rounded-lg text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <button
            onClick={() => setSelected(new Set())}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
          <div className="flex gap-2 ml-auto">
            {showCategory && categories.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => { setEditCategoryId(""); setEditOpen(true); }}>
                <Pencil className="size-3.5" /> Edit
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-3.5" /> Delete
            </Button>
          </div>
        </div>
      )}

      <div className="border table-outer rounded-lg overflow-x-auto hidden md:block">
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow>
              {isAdmin && (
                <TableHead className="w-10 px-0">
                  <label className="flex items-center justify-center w-full py-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                      onChange={toggleAll}
                      className="size-4 cursor-pointer"
                    />
                  </label>
                </TableHead>
              )}
              <TableHead className="w-48">Name</TableHead>
              {showCategory && <TableHead className="w-36">Category</TableHead>}
              {stockMode === "full" && <TableHead className="w-32">On hand</TableHead>}
              {stockMode === "full" && <TableHead className="w-32">Reserved</TableHead>}
              {stockMode !== "none" && <TableHead className="w-32">Available</TableHead>}
              {showCost && <TableHead className="w-32 text-right">Last cost</TableHead>}
              {showCost && <TableHead className="w-32 text-right">Avg. cost</TableHead>}
              {linkedRecipeProductIds && <TableHead className="w-24">Recipe</TableHead>}
              <TableHead className="w-44">Last updated</TableHead>
              <TableHead />
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <ItemTableRow
                key={item.id}
                item={item}
                isAdmin={isAdmin}
                itemTypeSlug={itemTypeSlug}
                showCategory={showCategory}
                stockMode={stockMode}
                showCost={showCost}
                isSelected={selected.has(item.id)}
                onToggleSelect={isAdmin ? () => toggleOne(item.id) : undefined}
                hasRecipe={linkedRecipeProductIds ? linkedRecipeProductIds.has(item.id) : undefined}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Bulk delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {selected.size} item{selected.size !== 1 ? "s" : ""}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will soft-delete the selected items. They won&apos;t appear in lists but existing references will be preserved.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkDelete} disabled={pending}>
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit {selected.size} item{selected.size !== 1 ? "s" : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Category</label>
              <Select value={editCategoryId || "__unchanged__"} onValueChange={(v) => setEditCategoryId(v === "__unchanged__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="— Keep unchanged —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unchanged__">— Keep unchanged —</SelectItem>
                  <SelectItem value={NONE}>Uncategorized</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkEdit} disabled={pending || !editCategoryId}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
