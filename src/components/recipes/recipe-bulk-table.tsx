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
import { Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { RecipeTableRowClient } from "./recipe-table-row";
import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { bulkDeleteRecipes } from "@/app/actions/recipes";
import type { Updater } from "@/lib/supabase/types";

export const RECIPE_COLUMNS: ColumnDef[] = [
  { key: "type", label: "Type" },
  { key: "output", label: "Output" },
  { key: "ingredients", label: "Ingredients" },
  { key: "lastUpdated", label: "Last updated", defaultHidden: true },
];

type RecipeRow = {
  id: string;
  name: string;
  recipe_type: string | null;
  updated_at: string;
  updater: Updater | null;
  recipe_items: { id: string }[];
  product: { name: string; type: string } | null;
};

type Props = {
  recipes: RecipeRow[];
  isAdmin: boolean;
};

export function RecipeBulkTable({ recipes, isAdmin }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { isVisible } = useColumnVisibility("recipes", RECIPE_COLUMNS);

  const allIds = recipes.map((r) => r.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
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
      const res = await bulkDeleteRecipes([...selected]);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${selected.size} recipe${selected.size !== 1 ? "s" : ""} deleted`);
      setSelected(new Set());
      setDeleteOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {someSelected && isAdmin && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border rounded-lg text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <button onClick={() => setSelected(new Set())} className="text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
          <div className="ml-auto">
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
                <TableHead className="w-8 px-0">
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
              <TableHead className="w-[240px]">Name</TableHead>
              {isVisible("type") && <TableHead className="w-[160px]">Type</TableHead>}
              {isVisible("output") && <TableHead className="w-[160px]">Output</TableHead>}
              {isVisible("ingredients") && <TableHead className="w-[160px]">Ingredients</TableHead>}
              {isVisible("lastUpdated") && <TableHead className="w-[160px]">Last updated</TableHead>}
              <TableHead className="w-0 p-0" />
              <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {recipes.map((r) => (
              <RecipeTableRowClient
                key={r.id}
                id={r.id}
                name={r.name}
                product={r.product?.name ?? null}
                productType={r.recipe_type ?? r.product?.type ?? null}
                ingredientCount={r.recipe_items.length}
                updatedAt={r.updated_at}
                updater={r.updater}
                isAdmin={isAdmin}
                isSelected={selected.has(r.id)}
                onToggleSelect={isAdmin ? () => toggleOne(r.id) : undefined}
                showType={isVisible("type")}
                showOutput={isVisible("output")}
                showIngredients={isVisible("ingredients")}
                showLastUpdated={isVisible("lastUpdated")}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {selected.size} recipe{selected.size !== 1 ? "s" : ""}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete the selected recipes and their ingredients.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkDelete} disabled={pending}>
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
