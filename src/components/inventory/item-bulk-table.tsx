"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableHead, TableHeader, TableRow, STICKY_ACTION_HEAD,
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
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { getItemColumns } from "@/lib/item-columns";
import { bulkDeleteItems, bulkUpdateItems } from "@/app/actions/inventory";
import type { ItemWithCategory } from "@/lib/supabase/types";
import type { ItemTypeSlug, StockMode } from "@/lib/item-types";

type Category = { id: string; name: string };

type Props = {
  items: ItemWithCategory[];
  categories: Category[];
  locations?: { id: string; name: string }[];
  isAdmin: boolean;
  itemTypeSlug: ItemTypeSlug;
  showPhoto?: boolean;
  showCategory: boolean;
  showLocation?: boolean;
  stockMode: StockMode;
  showCost: boolean;
  showSellable?: boolean;
  showDefaultCost?: boolean;
  linkedRecipeProductIds?: Set<string>;
};

const NONE = "__none__";

export function ItemBulkTable({
  items, categories, locations = [], isAdmin, itemTypeSlug, showPhoto = false, showCategory, showLocation = false, stockMode, showCost, showSellable, showDefaultCost, linkedRecipeProductIds,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState<string>("");
  const [editLocationId, setEditLocationId] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const columns = getItemColumns({
    showCategory, showLocation, stockMode, showCost, showSellable, showDefaultCost,
    hasRecipeColumn: !!linkedRecipeProductIds,
  });
  const { isVisible } = useColumnVisibility(`items-${itemTypeSlug}`, columns);

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
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
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
    if (editLocationId === NONE) patch.location_id = null;
    else if (editLocationId) patch.location_id = editLocationId;
    if (!Object.keys(patch).length) { toast.error("Nothing to change"); return; }

    startTransition(async () => {
      const res = await bulkUpdateItems([...selected], patch);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${selected.size} item${selected.size !== 1 ? "s" : ""} updated`);
      setSelected(new Set());
      setEditOpen(false);
      setEditCategoryId("");
      setEditLocationId("");
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
            {((showCategory && categories.length > 0) || showLocation) && (
              <Button size="sm" variant="outline" onClick={() => { setEditCategoryId(""); setEditLocationId(""); setEditOpen(true); }}>
                <Pencil className="size-3.5" /> Edit
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-3.5" /> Delete
            </Button>
          </div>
        </div>
      )}

      <div className="border table-outer rounded-lg overflow-x-auto">
        <Table className="w-auto min-w-full table-fixed">
          <TableHeader>
            <TableRow>
              {isAdmin && (
                <TableHead className="w-8 pl-2 pr-0">
                  <label className="flex items-center justify-start w-full py-3 cursor-pointer">
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
              {showPhoto && <TableHead className="w-14" />}
              <TableHead className="w-[240px]">Name</TableHead>
              {showCategory && isVisible("category") && <TableHead className="w-[160px]">Category</TableHead>}
              {showLocation && isVisible("location") && <TableHead className="w-[160px]">Location</TableHead>}
              {stockMode === "full" && isVisible("onHand") && <TableHead className="w-[160px]">On hand</TableHead>}
              {stockMode === "full" && isVisible("reserved") && <TableHead className="w-[160px]">Reserved</TableHead>}
              {stockMode !== "none" && isVisible("available") && <TableHead className="w-[160px]">Available</TableHead>}
              {showCost && isVisible("lastCost") && <TableHead className="w-[160px] text-right">Last cost</TableHead>}
              {showCost && isVisible("avgCost") && <TableHead className="w-[160px] text-right">Avg. cost</TableHead>}
              {showDefaultCost && isVisible("defaultCost") && <TableHead className="w-[160px] text-right">Default cost</TableHead>}
              {showSellable && isVisible("sellable") && <TableHead className="w-[160px]">Sellable</TableHead>}
              {showSellable && isVisible("sellingPrice") && <TableHead className="w-[160px] text-right">Selling price</TableHead>}
              {showSellable && isVisible("addOn") && <TableHead className="w-[160px]">Add-on</TableHead>}
              {linkedRecipeProductIds && isVisible("recipe") && <TableHead className="w-[160px]">Recipe</TableHead>}
              {isVisible("lastUpdated") && <TableHead className="w-[160px]">Last updated</TableHead>}
              <TableHead className="w-0 p-0" />
              <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <ItemTableRow
                key={item.id}
                item={item}
                isAdmin={isAdmin}
                itemTypeSlug={itemTypeSlug}
                showPhoto={showPhoto}
                showCategory={showCategory && isVisible("category")}
                showLocation={showLocation && isVisible("location")}
                showOnHand={stockMode === "full" && isVisible("onHand")}
                showReserved={stockMode === "full" && isVisible("reserved")}
                showAvailable={stockMode !== "none" && isVisible("available")}
                showLastCost={showCost && isVisible("lastCost")}
                showAvgCost={showCost && isVisible("avgCost")}
                showDefaultCost={showDefaultCost && isVisible("defaultCost")}
                showSellable={showSellable && isVisible("sellable")}
                showSellingPrice={showSellable && isVisible("sellingPrice")}
                showAddOn={showSellable && isVisible("addOn")}
                showRecipe={isVisible("recipe")}
                showLastUpdated={isVisible("lastUpdated")}
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
            {showCategory && categories.length > 0 && (
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
            )}
            {showLocation && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Location</label>
                <Select value={editLocationId || "__unchanged__"} onValueChange={(v) => setEditLocationId(v === "__unchanged__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="— Keep unchanged —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unchanged__">— Keep unchanged —</SelectItem>
                    <SelectItem value={NONE}>No location</SelectItem>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkEdit} disabled={pending || (!editCategoryId && !editLocationId)}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
