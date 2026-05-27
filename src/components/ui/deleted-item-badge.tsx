"use client";

import { TriangleAlert } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function DeletedItemBadge() {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex shrink-0 items-center ml-1.5 align-middle cursor-default">
            <TriangleAlert className="size-3.5 text-muted-foreground" />
          </span>
        </TooltipTrigger>
        <TooltipContent>Item has been deleted</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
