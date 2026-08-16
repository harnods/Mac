"use client";

import { rollupItemQty, itemQtyBreakdown, formatNum, type ItemUnitConversion } from "@/lib/units";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Renders a base-unit quantity rolled up to the largest whole packaging unit
 * (e.g. 24000 ml → "2 karton"), with a hover tooltip showing the full breakdown
 * (2 karton · 24 box · 24.000 ml). Display-only; the stored value stays in the
 * base unit. Pass the item's custom unit conversions so it knows the packaging.
 */
export function ItemQty({
  baseValue,
  unit,
  conversions,
  className,
}: {
  baseValue: number;
  unit: string;
  conversions?: ItemUnitConversion[] | null;
  className?: string;
}) {
  const item = { unit, item_unit_conversions: conversions ?? [] };
  const rolled = rollupItemQty(baseValue, item);
  const breakdown = itemQtyBreakdown(baseValue, item);
  const label = `${formatNum(rolled.value)} ${rolled.unit}`;

  if (breakdown.length <= 1) {
    return <span className={className}>{label}</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`cursor-default underline decoration-dashed underline-offset-2 ${className ?? ""}`}>
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {breakdown.map((b) => `${formatNum(b.value)} ${b.unit}`).join(" · ")}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
