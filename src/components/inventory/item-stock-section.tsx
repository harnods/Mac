"use client";

import { formatNum, formatQty } from "@/lib/units";
import { Qty } from "@/components/ui/qty";
import { formatDate, formatRp } from "@/lib/format";
import type { StockMode } from "@/lib/item-types";
import type { UnitCode } from "@/lib/supabase/types";

type Props = {
  baseUnit: UnitCode;
  onHand: number;
  reserved: number;
  stockMode: StockMode;
  hasCategories: boolean;
  categoryName: string | null;
  lastPurchaseCost: number | null;
  avgPurchaseCost: number | null;
  updatedAt: string;
  updaterLabel: string | null;
};

export function ItemStockSection({
  baseUnit,
  onHand,
  reserved,
  stockMode,
  hasCategories,
  categoryName,
  lastPurchaseCost,
  avgPurchaseCost,
  updatedAt,
  updaterLabel,
}: Props) {
  const available = onHand - reserved;

  return (
    <div className="space-y-6">
      {stockMode !== 'none' && (
        <div className={`grid gap-6 ${stockMode === 'full' ? 'grid-cols-3' : 'grid-cols-1'}`}>
          {stockMode === 'full' && (
            <>
              <div>
                <div className="text-xs uppercase text-muted-foreground tracking-wide">On hand</div>
                <div className="text-2xl font-semibold tabular-nums mt-1"><Qty value={onHand} unit={baseUnit} /></div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground tracking-wide">Reserved</div>
                <div className="text-2xl font-semibold tabular-nums mt-1"><Qty value={reserved} unit={baseUnit} /></div>
              </div>
            </>
          )}
          <div>
            <div className="text-xs uppercase text-muted-foreground tracking-wide">Available</div>
            <div className="text-2xl font-semibold tabular-nums mt-1"><Qty value={available} unit={baseUnit} /></div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm text-foreground">
        <span className="text-muted-foreground">Default base unit</span><span>{baseUnit}</span>
        {hasCategories && categoryName && (
          <><span className="text-muted-foreground">Category</span><span>{categoryName}</span></>
        )}
        {lastPurchaseCost != null && (
          <><span className="text-muted-foreground">Last purchase cost</span><span className="tabular-nums">{formatRp(lastPurchaseCost)} / {baseUnit}</span></>
        )}
        {avgPurchaseCost != null && (
          <><span className="text-muted-foreground">Avg. purchase cost</span><span className="tabular-nums">{formatRp(avgPurchaseCost)} / {baseUnit}</span></>
        )}
        {updaterLabel && (
          <><span className="text-muted-foreground">Last updated</span>
          <span>{formatDate(updatedAt)} by {updaterLabel}</span></>
        )}
      </div>
    </div>
  );
}
