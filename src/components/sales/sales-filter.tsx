"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function SalesFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();

  const q = params.get("q") ?? "";
  const hasFilter = q !== "";

  const push = useCallback(
    (next: Record<string, string>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v === "") sp.delete(k);
        else sp.set(k, v);
      }
      start(() => router.replace(`${pathname}?${sp.toString()}`, { scroll: false }));
    },
    [params, pathname, router],
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {hasFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => push({ q: "" })}
            className="text-muted-foreground"
          >
            <X className="size-4" /> Clear
          </Button>
        )}
      </div>
      <Input
        placeholder="Search by notes..."
        defaultValue={q}
        onChange={(e) => push({ q: e.target.value })}
        className="w-full sm:w-64"
      />
    </div>
  );
}
