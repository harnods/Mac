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
  /** Custom trigger element; receives the open handler. Defaults to the recipe name as a text link. */
  trigger?: (onClick: () => void) => React.ReactNode;
};

export function RecipeDrawerTrigger({ recipeId, recipeName, trigger }: Props) {
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
      {trigger ? trigger(handleOpen) : (
        <button
          onClick={handleOpen}
          className="hover:underline text-left"
        >
          {recipeName}
        </button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-xl">
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
                    <div>
                      <div className="grid grid-cols-3 gap-x-4 pb-1 border-b text-xs text-muted-foreground">
                        <span>Ingredient</span>
                        <span className="text-right">Qty</span>
                        <span className="text-right">Cost</span>
                      </div>
                      {data.ingredients.map((ing, idx) => (
                        <div key={`${ing.id}-${idx}`} className="grid grid-cols-3 gap-x-4 items-center py-1.5 border-b last:border-0 text-sm">
                          <span className="truncate">{ing.name}</span>
                          <span className="tabular-nums text-muted-foreground text-right whitespace-nowrap">
                            {formatNum(ing.quantity)} {ing.unit}
                          </span>
                          <span className="tabular-nums text-right">
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
