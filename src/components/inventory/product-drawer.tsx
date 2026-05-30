"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose, SheetBody } from "@/components/ui/sheet";
import { getProductDrawerData } from "@/app/actions/inventory";
import type { ProductDrawerData } from "@/app/actions/inventory";

type Props = {
  productId: string;
  productName: string;
};

export function ProductDrawerTrigger({ productId, productName }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ProductDrawerData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || data) return;
    setLoading(true);
    getProductDrawerData(productId).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [open, productId, data]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="font-medium hover:underline text-left"
      >
        {productName}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{data?.name ?? productName}</SheetTitle>
            <SheetClose />
          </SheetHeader>

          <SheetBody>
            {loading && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}

            {!loading && data && (
              <div className="space-y-6">
                {/* Product info */}
                <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
                  {data.category && (
                    <>
                      <span className="text-muted-foreground">Category</span>
                      <span>{data.category}</span>
                    </>
                  )}
                  <span className="text-muted-foreground">Unit</span>
                  <span>{data.unit}</span>
                  {data.status && (
                    <>
                      <span className="text-muted-foreground">Status</span>
                      <span className="capitalize">{data.status}</span>
                    </>
                  )}
                </div>

                {/* Recipe ingredients */}
                {data.recipe && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Recipe ingredients
                    </p>
                    {data.recipe.items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No ingredients.</p>
                    ) : (
                      <div className="space-y-1">
                        {data.recipe.items.map((item, idx) => (
                          <div key={item.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                            <span className="flex items-center gap-2">
                              <span className="text-muted-foreground tabular-nums w-5 text-right">{idx + 1}.</span>
                              <span>{item.name}</span>
                            </span>
                            <span className="tabular-nums text-muted-foreground">
                              {item.quantity} {item.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Links */}
                <div className="flex flex-col gap-2 pt-2">
                  <Link
                    href={`/inventory/products/${data.id}`}
                    className="flex items-center gap-1.5 text-sm hover:underline"
                    onClick={() => setOpen(false)}
                  >
                    <ExternalLink className="size-3.5" />
                    View product page
                  </Link>
                  {data.recipe && (
                    <Link
                      href={`/recipes/${data.recipe.id}/edit`}
                      className="flex items-center gap-1.5 text-sm hover:underline"
                      onClick={() => setOpen(false)}
                    >
                      <ExternalLink className="size-3.5" />
                      Edit recipe
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
