"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose, SheetBody } from "@/components/ui/sheet";
import { formatNum } from "@/lib/units";
import { formatRp } from "@/lib/format";
import { getRecipeDrawerData } from "@/app/actions/recipes";
import type { RecipeDrawerData } from "@/app/actions/recipes";
import type { RecipeCostSource } from "@/lib/cogs-server";

const SOURCE_LABEL: Record<RecipeCostSource, string> = {
  avg: "avg cost",
  last: "last cost",
  default: "est.",
  recipe: "from recipe",
};

type Props = {
  recipeId: string;
  recipeName: string;
};

export function RecipeDrawerTrigger({ recipeId, recipeName }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<RecipeDrawerData | null>(null);
  const [loading, setLoading] = useState(false);

  function handleOpen() {
    setOpen(true);
    if (data) return;
    setLoading(true);
    getRecipeDrawerData(recipeId).then((d) => {
      setData(d);
      setLoading(false);
    });
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="hover:underline text-left"
      >
        {recipeName}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{data?.name ?? recipeName}</SheetTitle>
            <SheetClose />
          </SheetHeader>

          <SheetBody>
            {loading && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}

            {!loading && data && (
              <div className="space-y-6">
                <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
                  <span className="text-muted-foreground">Type</span>
                  <span>{data.recipeType === "wip" ? "For prep item" : "Product"}</span>
                  {data.productName && (
                    <>
                      <span className="text-muted-foreground">Output</span>
                      <span>{data.productName}</span>
                    </>
                  )}
                  <span className="text-muted-foreground">Yield</span>
                  <span className="tabular-nums">
                    {formatNum(data.yieldQty)} {data.yieldUnit} per batch
                  </span>
                </div>

                {data.ingredients.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Ingredients
                    </p>
                    <div className="space-y-1">
                      {data.ingredients.map((ing, idx) => (
                        <div key={`${ing.id}-${idx}`} className="flex items-center justify-between gap-3 text-sm py-1 border-b last:border-0">
                          <span className="truncate">{ing.name}</span>
                          <span className="flex items-center gap-2 shrink-0">
                            <span className="tabular-nums text-muted-foreground">
                              {formatNum(ing.quantity)} {ing.unit}
                            </span>
                            <span className="tabular-nums w-20 text-right">
                              {ing.cost != null ? (
                                <>
                                  {formatRp(ing.cost)}
                                  {ing.source && ing.source !== "avg" && (
                                    <span className="block text-[10px] text-muted-foreground leading-tight">
                                      {SOURCE_LABEL[ing.source]}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-sm pt-2 border-t">
                      <span className="text-muted-foreground">Total COGS</span>
                      <span className="tabular-nums font-medium">
                        {formatRp(data.totalCost)}
                        {data.hasIncompleteCost && (
                          <span className="block text-xs text-muted-foreground font-normal text-right">incomplete</span>
                        )}
                      </span>
                    </div>
                    {data.yieldQty !== 1 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Cost per {data.yieldUnit}</span>
                        <span className="tabular-nums">{formatRp(data.costPerYieldUnit)}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-2">
                  <Link
                    href={`/recipes/${data.id}`}
                    className="flex items-center gap-1.5 text-sm hover:underline"
                    onClick={() => setOpen(false)}
                  >
                    <ExternalLink className="size-3.5" />
                    View recipe page
                  </Link>
                </div>
              </div>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </>
  );
}
