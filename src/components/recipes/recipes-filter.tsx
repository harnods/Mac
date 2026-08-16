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
import { RECIPE_COLUMNS } from "@/components/recipes/recipe-bulk-table";

const ALL = "__all__";

export function RecipesFilter() {
  const { isVisible, toggle } = useColumnVisibility("recipes", RECIPE_COLUMNS);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();

  const q = params.get("q") ?? "";
  const type = params.get("type") ?? ALL;
  const category = params.get("category") ?? ALL;
  const hasFilter = q !== "" || type !== ALL || category !== ALL;

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
      <div className="flex items-center gap-2">
        <Select value={type} onValueChange={(v) => push({ type: v })}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            <SelectItem value="wip">For prep item</SelectItem>
            <SelectItem value="product">Product</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={(v) => push({ category: v })}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            <SelectItem value="bar">Bar</SelectItem>
            <SelectItem value="kitchen">Kitchen</SelectItem>
          </SelectContent>
        </Select>
        {hasFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => push({ q: "", type: ALL, category: ALL })}
            className="text-muted-foreground"
          >
            <X className="size-4" /> Clear
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <ColumnsMenu columns={RECIPE_COLUMNS} isVisible={isVisible} toggle={toggle} />
        <Input
          placeholder="Search recipes..."
          defaultValue={q}
          onChange={(e) => push({ q: e.target.value })}
          className="w-full sm:w-56"
        />
      </div>
    </div>
  );
}
