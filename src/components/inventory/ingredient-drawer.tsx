"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose, SheetBody } from "@/components/ui/sheet";
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
                <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
                  <span className="text-muted-foreground">Type</span>
                  <span>{data.type}</span>
                  {data.category && (
                    <>
                      <span className="text-muted-foreground">Category</span>
                      <span>{data.category}</span>
                    </>
                  )}
                  <span className="text-muted-foreground">Unit</span>
                  <span>{data.unit}</span>
                </div>

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

                <div className="pt-2">
                  <Link
                    href={data.itemPageUrl}
                    className="flex items-center gap-1.5 text-sm hover:underline"
                    onClick={() => setOpen(false)}
                  >
                    <ExternalLink className="size-3.5" />
                    View {data.type.toLowerCase()} page
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
