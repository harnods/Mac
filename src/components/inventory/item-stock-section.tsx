"use client";

import { formatNum, formatQty } from "@/lib/units";
import { ItemQty } from "@/components/ui/item-qty";
import { DetailRow } from "@/components/ui/detail-list";
import { formatDate, formatRp } from "@/lib/format";
import { defaultCostBreakdown } from "@/lib/cogs";
import type { StockMode } from "@/lib/item-types";
import type { UnitCode } from "@/lib/supabase/types";

type Props = {
  baseUnit: UnitCode;
  onHand: number;
  reserved: number;
  stockMode: StockMode;
  hasCategories: boolean;
  categoryName: string | null;
  locationName?: string | null;
  lastPurchaseCost: number | null;
  avgPurchaseCost: number | null;
  defaultPurchaseCost: number | null;
  defaultPurchaseCostUnit: UnitCode | null;
  purchaseUnit: UnitCode | null;
  purchaseUnitQty: number | null;
  conversions?: { from_unit: string; factor: number; to_unit: string }[];
  showSellPrice?: boolean;
  sellPrice?: number | null;
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
  locationName = null,
  lastPurchaseCost,
  avgPurchaseCost,
  defaultPurchaseCost,
  defaultPurchaseCostUnit,
  purchaseUnit,
  purchaseUnitQty,
  conversions = [],
  showSellPrice = false,
  sellPrice = null,
  updatedAt,
  updaterLabel,
}: Props) {
  const available = onHand - reserved;
  const breakdown = defaultCostBreakdown({
    unit: baseUnit,
    last_purchase_cost: lastPurchaseCost,
    avg_purchase_cost: avgPurchaseCost,
    default_purchase_cost: defaultPurchaseCost,
    default_purchase_cost_unit: defaultPurchaseCostUnit,
    purchase_unit: purchaseUnit,
    purchase_unit_qty: purchaseUnitQty,
  });

  return (
    <div className="space-y-6">
      {stockMode !== 'none' && (
        <div className={`grid gap-6 ${stockMode === 'full' ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1'}`}>
          {stockMode === 'full' && (
            <>
              <div>
                <div className="text-xs uppercase text-muted-foreground tracking-wide">On hand</div>
                <div className="text-2xl font-semibold tabular-nums mt-1"><ItemQty baseValue={onHand} unit={baseUnit} conversions={conversions} /></div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground tracking-wide">Reserved</div>
                <div className="text-2xl font-semibold tabular-nums mt-1"><ItemQty baseValue={reserved} unit={baseUnit} conversions={conversions} /></div>
              </div>
            </>
          )}
          <div>
            <div className="text-xs uppercase text-muted-foreground tracking-wide">Available</div>
            <div className="text-2xl font-semibold tabular-nums mt-1"><ItemQty baseValue={available} unit={baseUnit} conversions={conversions} /></div>
          </div>
        </div>
      )}

      <dl>
        {hasCategories && categoryName && <DetailRow label="Category" value={categoryName} />}
        {locationName && <DetailRow label="Location" value={locationName} />}
        <DetailRow label="Default base unit" value={baseUnit} />
        {showSellPrice && (
          <DetailRow
            label="Selling price"
            value={sellPrice != null ? <span className="tabular-nums">{formatRp(sellPrice)}</span> : undefined}
          />
        )}
        {purchaseUnit && purchaseUnitQty != null && (
          <DetailRow label="Purchase unit" value={`1 ${purchaseUnit} = ${formatNum(purchaseUnitQty)} ${baseUnit}`} />
        )}
        {defaultPurchaseCost != null && (
          <DetailRow
            label="Default purchase cost"
            value={
              <span className="tabular-nums">
                {formatRp(defaultPurchaseCost)} / {defaultPurchaseCostUnit ?? baseUnit}
                {breakdown != null && (
                  <span className="block text-xs text-muted-foreground">{formatRp(breakdown)} / {baseUnit}</span>
                )}
              </span>
            }
          />
        )}
        {lastPurchaseCost != null && (
          <DetailRow label="Last purchase cost" value={<span className="tabular-nums">{formatRp(lastPurchaseCost)} / {baseUnit}</span>} />
        )}
        {avgPurchaseCost != null && (
          <DetailRow label="Avg. purchase cost" value={<span className="tabular-nums">{formatRp(avgPurchaseCost)} / {baseUnit}</span>} />
        )}
        {updaterLabel && (
          <DetailRow label="Last updated" value={`${formatDate(updatedAt)} by ${updaterLabel}`} />
        )}
      </dl>
    </div>
  );
}
