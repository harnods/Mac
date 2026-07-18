"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Qty } from "@/components/ui/qty";
import { formatRp } from "@/lib/format";
import { IngredientDrawerTrigger } from "@/components/inventory/ingredient-drawer";
import { DeletedItemBadge } from "@/components/ui/deleted-item-badge";
import type { RecipeCostLine, RecipeCostSource } from "@/lib/cogs-server";

const SOURCE_LABEL: Record<RecipeCostSource, string> = {
  avg: "avg cost",
  last: "last cost",
  default: "est.",
  recipe: "from recipe",
};

type RecipeIngredient = {
  id: string;
  quantity: number;
  unit: string;
  item: { id: string; name: string; deleted_at: string | null } | null;
};

export function RecipeIngredientsList({
  rows,
}: {
  rows: { ri: RecipeIngredient; line: RecipeCostLine }[];
}) {
  const [q, setQ] = useState("");
  const filtered = rows.filter(({ ri }) => (ri.item?.name ?? "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Input
          placeholder="Search ingredients..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full sm:w-56"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No matching ingredients.</p>
      ) : (
        <div>
          <div className="grid grid-cols-[2rem_1fr_7rem_7rem] gap-x-6 py-2 border-b text-xs text-muted-foreground">
            <span />
            <span className="pl-3">Ingredient</span>
            <span>Qty</span>
            <span className="text-right">Cost</span>
          </div>
          {filtered.map(({ ri, line }, idx) => (
            <div key={ri.id} className="grid grid-cols-[2rem_1fr_7rem_7rem] gap-x-6 items-center py-2 border-b last:border-0">
              <span className="text-sm text-muted-foreground text-right">{idx + 1}.</span>
              <span className="font-medium text-sm pl-3 flex items-center gap-1.5">
                {ri.item && !ri.item.deleted_at
                  ? <IngredientDrawerTrigger itemId={ri.item.id} itemName={ri.item.name} />
                  : ri.item?.name ?? "—"}
                {ri.item?.deleted_at && <DeletedItemBadge />}
              </span>
              <span className="tabular-nums text-sm">
                <Qty value={ri.quantity} unit={ri.unit} />
              </span>
              <span className="tabular-nums text-sm text-right">
                {line.cost != null ? (
                  <>
                    {formatRp(line.cost)}
                    {line.source && line.source !== "avg" && (
                      <span className="text-muted-foreground text-xs"> ({SOURCE_LABEL[line.source]})</span>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
