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
import { ColumnsMenu } from "@/components/ui/columns-menu";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { getItemColumns, type ItemColumnFlags } from "@/lib/item-columns";
import type { Category } from "@/lib/supabase/types";
import type { ItemTypeSlug } from "@/lib/item-types";

const ALL = "__all__";

export function ItemsFilter({
  categories,
  label = "items",
  itemTypeSlug,
  columnFlags,
}: {
  categories: Pick<Category, "id" | "name">[];
  label?: string;
  itemTypeSlug: ItemTypeSlug;
  columnFlags: ItemColumnFlags;
}) {
  const columns = getItemColumns(columnFlags);
  const { isVisible, toggle } = useColumnVisibility(`items-${itemTypeSlug}`, columns);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();

  const q = params.get("q") ?? "";
  const cat = params.get("cat") ?? ALL;
  const hasFilter = q !== "" || (categories.length > 0 && cat !== ALL);

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
        {categories.length > 0 && (
          <Select value={cat} onValueChange={(v) => push({ cat: v })}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {hasFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => push({ q: "", cat: ALL })}
            className="text-muted-foreground"
          >
            <X className="size-4" /> Clear
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <ColumnsMenu columns={columns} isVisible={isVisible} toggle={toggle} />
        <Input
          placeholder={`Search ${label}...`}
          defaultValue={q}
          onChange={(e) => push({ q: e.target.value })}
          className="w-full sm:w-56"
        />
      </div>
    </div>
  );
}
