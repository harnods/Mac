"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose, SheetBody } from "@/components/ui/sheet";
import { formatNum } from "@/lib/units";
import { formatRp } from "@/lib/format";
import { defaultCostBreakdown } from "@/lib/cogs";
import { getIngredientDrawerData } from "@/app/actions/inventory";
import type { IngredientDrawerData } from "@/app/actions/inventory";

type Props = {
  itemId: string;
  itemName: string;
};

export function IngredientDrawerTrigger({ itemId, itemName }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<IngredientDrawerData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || data) return;
    setLoading(true);
    getIngredientDrawerData(itemId).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [open, itemId, data]);

  const breakdown = data ? defaultCostBreakdown(data) : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hover:underline text-left"
      >
        {itemName}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{data?.name ?? itemName}</SheetTitle>
            <SheetClose />
          </SheetHeader>

          <SheetBody>
            {loading && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}

            {!loading && data && (
              <div className="space-y-6">
                {data.stockMode !== "none" && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Stock
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {data.stockMode === "full" && (
                        <>
                          <div className="space-y-0.5">
                            <p className="text-xs text-muted-foreground">On hand</p>
                            <p className="text-sm font-medium tabular-nums">{data.on_hand} {data.unit}</p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-xs text-muted-foreground">Reserved</p>
                            <p className="text-sm font-medium tabular-nums">{data.reserved} {data.unit}</p>
                          </div>
                        </>
                      )}
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">Available</p>
                        <p className="text-sm font-medium tabular-nums">{data.available} {data.unit}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
                    <span className="text-muted-foreground">Type</span>
                    <span>{data.type}</span>
                    {data.category && (
                      <>
                        <span className="text-muted-foreground">Category</span>
                        <span>{data.category}</span>
                      </>
                    )}
                    <span className="text-muted-foreground">Default base unit</span>
                    <span>{data.unit}</span>
                  </div>

                  {(data.purchase_unit || data.default_purchase_cost != null || data.last_purchase_cost != null || data.avg_purchase_cost != null || data.computedCost) && (
                    <>
                      <div className="border-t" />

                      <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
                        {data.purchase_unit && data.purchase_unit_qty != null && (
                          <>
                            <span className="text-muted-foreground">Purchase unit</span>
                            <span>1 {data.purchase_unit} = {formatNum(data.purchase_unit_qty)} {data.unit}</span>
                          </>
                        )}
                        {data.default_purchase_cost != null && (
                          <>
                            <span className="text-muted-foreground">Default purchase cost</span>
                            <span className="tabular-nums">
                              {formatRp(data.default_purchase_cost)} / {data.default_purchase_cost_unit ?? data.unit}
                              {breakdown != null && (
                                <span className="block text-xs text-muted-foreground">{formatRp(breakdown)} / {data.unit}</span>
                              )}
                            </span>
                          </>
                        )}
                        {data.last_purchase_cost != null && (
                          <>
                            <span className="text-muted-foreground">Last purchase cost</span>
                            <span className="tabular-nums">{formatRp(data.last_purchase_cost)} / {data.unit}</span>
                          </>
                        )}
                        {data.avg_purchase_cost != null && (
                          <>
                            <span className="text-muted-foreground">Avg. purchase cost</span>
                            <span className="tabular-nums">{formatRp(data.avg_purchase_cost)} / {data.unit}</span>
                          </>
                        )}
                        {data.computedCost && (
                          <>
                            <span className="text-muted-foreground">Yield</span>
                            <span className="tabular-nums">
                              {formatNum(data.computedCost.yieldQty)} {data.computedCost.yieldUnit} per batch
                            </span>
                            <span className="text-muted-foreground">Recipe COGS</span>
                            <span className="tabular-nums">
                              {formatRp(data.computedCost.totalCost)}
                              {data.computedCost.hasIncompleteCost && (
                                <span className="text-xs text-muted-foreground"> (incomplete)</span>
                              )}
                            </span>
                            <span className="text-muted-foreground">Cost per {data.unit}</span>
                            <span className="tabular-nums">{formatRp(data.computedCost.costPerBaseUnit)} / {data.unit}</span>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {data.usedInRecipes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Used in recipes
                    </p>
                    <div className="space-y-1">
                      {data.usedInRecipes.map((r, idx) => (
                        <div key={`${r.id}-${idx}`} className="flex items-center justify-between gap-3 text-sm">
                          <Link
                            href={`/recipes/${r.id}`}
                            className="hover:underline truncate"
                            onClick={() => setOpen(false)}
                          >
                            {r.name}
                          </Link>
                          <span className="tabular-nums text-muted-foreground shrink-0">
                            {formatNum(r.quantity)} {r.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 flex flex-col gap-2">
                  <Link
                    href={data.itemPageUrl}
                    className="flex items-center gap-1.5 text-sm hover:underline"
                    onClick={() => setOpen(false)}
                  >
                    <ExternalLink className="size-3.5" />
                    View {data.type.toLowerCase()} page
                  </Link>
                  {data.producedByRecipe && (
                    <Link
                      href={`/recipes/${data.producedByRecipe.id}`}
                      className="flex items-center gap-1.5 text-sm hover:underline"
                      onClick={() => setOpen(false)}
                    >
                      <ExternalLink className="size-3.5" />
                      View recipe ({data.producedByRecipe.name})
                    </Link>
                  )}
                </div>
              </div>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </>
  );
}
