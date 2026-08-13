"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { convert, downConversionTarget, formatNum } from "@/lib/units";
import type { UnitCode } from "@/lib/supabase/types";

/**
 * Renders a quantity + unit.
 * - When `auto` (default), large weights/volumes are shown in the bigger unit
 *   for readability (1000+ g → kg, 1000+ ml → l), with a tooltip that keeps the
 *   exact base value (e.g. "6,1 kg" → tooltip "6.100 g").
 * - Otherwise, if a down-conversion exists (kg↔g, l↔ml), the value gets a
 *   tooltip showing the smaller unit.
 * Pass `auto={false}` where the caller manages the display unit itself.
 */
export function Qty({
  value,
  unit,
  className,
  auto = true,
}: {
  value: number;
  unit: string;
  className?: string;
  auto?: boolean;
}) {
  const upUnit = auto
    ? unit === "g" && Math.abs(value) >= 1000
      ? "kg"
      : unit === "ml" && Math.abs(value) >= 1000
        ? "l"
        : null
    : null;

  // Up-converted display (g→kg / ml→l); tooltip shows the exact base value.
  if (upUnit) {
    const converted = convert(value, unit as UnitCode, upUnit as UnitCode) ?? value / 1000;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`${className ?? ""} cursor-default underline decoration-dashed decoration-muted-foreground/50 underline-offset-2`}>
              {formatNum(converted)} <span className="text-muted-foreground">{upUnit}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {formatNum(value)} {unit}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const otherUnit = downConversionTarget(unit as UnitCode);
  const converted = otherUnit != null ? convert(value, unit as UnitCode, otherUnit) : null;

  if (converted == null || otherUnit == null) {
    return (
      <span className={className}>
        {formatNum(value)} <span className="text-muted-foreground">{unit}</span>
      </span>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`${className ?? ""} cursor-default underline decoration-dashed decoration-muted-foreground/50 underline-offset-2`}>
            {formatNum(value)} <span className="text-muted-foreground">{unit}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {formatNum(converted)} {otherUnit}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
