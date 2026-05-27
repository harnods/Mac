"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { convert, compatibleUnits, formatNum } from "@/lib/units";
import type { UnitCode } from "@/lib/supabase/types";

/**
 * Renders a quantity + unit. If a conversion exists (g↔kg, ml↔l),
 * the number is wrapped in a tooltip showing the converted value.
 */
export function Qty({
  value,
  unit,
  className,
}: {
  value: number;
  unit: string;
  className?: string;
}) {
  const allUnits = compatibleUnits(unit as UnitCode);
  const otherUnit = allUnits.find((u) => u !== unit) as UnitCode | undefined;
  const converted = otherUnit != null ? convert(value, unit as UnitCode, otherUnit) : null;

  if (converted == null || otherUnit == null) {
    return (
      <span className={className}>
        {formatNum(value)}{" "}
        <span className="text-muted-foreground">{unit}</span>
      </span>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`${className ?? ""} cursor-default underline decoration-dashed decoration-muted-foreground/50 underline-offset-2`}>
            {formatNum(value)}{" "}
            <span className="text-muted-foreground">{unit}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {formatNum(converted)} {otherUnit}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
