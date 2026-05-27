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

export function RecipesFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();

  const q = params.get("q") ?? "";
  const type = params.get("type") ?? ALL;
  const hasFilter = q !== "" || type !== ALL;

  const push = useCallback(
    (next: Record<string, string>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v === "" || v === ALL) sp.delete(k);
        else sp.set(k, v);
      }
      start(() => router.replace(`${pathname}?${sp.toString()}`, { scroll: false }));
    },
    [params, pathname, router],
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Select value={type} onValueChange={(v) => push({ type: v })}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            <SelectItem value="wip">WIP</SelectItem>
            <SelectItem value="product">Product</SelectItem>
          </SelectContent>
        </Select>
        {hasFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => push({ q: "", type: ALL })}
            className="text-muted-foreground"
          >
            <X className="size-4" /> Clear
          </Button>
        )}
      </div>
      <Input
        placeholder="Search recipes..."
        defaultValue={q}
        onChange={(e) => push({ q: e.target.value })}
        className="w-full sm:w-56"
      />
    </div>
  );
}
