"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition, useCallback } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const ALL = "__all__";

export function AdjustmentsFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();

  const q = params.get("q") ?? "";
  const direction = params.get("direction") ?? ALL;
  const hasFilter = q !== "" || direction !== ALL;

  const push = useCallback(
    (next: Record<string, string>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v === "" || v === ALL) sp.delete(k);
        else sp.set(k, v);
      }
      sp.delete("page");
      start(() => router.replace(`${pathname}?${sp.toString()}`, { scroll: false }));
    },
    [params, pathname, router],
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={direction} onValueChange={(v) => push({ direction: v })}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All directions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All directions</SelectItem>
            <SelectItem value="in">Stock in</SelectItem>
            <SelectItem value="out">Stock out</SelectItem>
          </SelectContent>
        </Select>
        {hasFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => push({ q: "", direction: ALL })}
            className="text-muted-foreground"
          >
            <X className="size-4" /> Clear
          </Button>
        )}
      </div>
      <Input
        placeholder="Search by item or reason..."
        defaultValue={q}
        onChange={(e) => push({ q: e.target.value })}
        className="w-full sm:w-64"
      />
    </div>
  );
}
