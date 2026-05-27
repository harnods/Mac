"use client";

import { AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatNum } from "@/lib/units";

type Props = {
  targetQty: number;
  actualQty: number;
  unit: string;
  reason: string | null;
};

export function VarianceIcon({ targetQty, actualQty, unit, reason }: Props) {
  const variance = actualQty - targetQty;
  const isWaste = variance < 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <AlertTriangle
            className={`size-3.5 shrink-0 cursor-default ${
              isWaste
                ? "text-red-500 dark:text-red-400"
                : "text-amber-500 dark:text-amber-400"
            }`}
          />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-56 space-y-1">
          <p className="font-medium">
            {isWaste ? "Waste" : "Non-standard"}
            {" · "}
            target {formatNum(targetQty)} {unit}
            {" → "}
            actual {formatNum(actualQty)} {unit}
            {" ("}
            {variance > 0 ? "+" : ""}
            {formatNum(variance)}
            {")"}
          </p>
          {reason && <p className="text-xs opacity-80">{reason}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
