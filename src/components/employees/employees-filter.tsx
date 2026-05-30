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

export function EmployeesFilter({
  departments,
}: {
  departments: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();

  const q = params.get("q") ?? "";
  const dept = params.get("dept") ?? ALL;
  const hasFilter = q !== "" || dept !== ALL;

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
        {departments.length > 0 && (
          <Select value={dept} onValueChange={(v) => push({ dept: v })}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {hasFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => push({ q: "", dept: ALL })}
            className="text-muted-foreground"
          >
            <X className="size-4" /> Clear
          </Button>
        )}
      </div>
      <Input
        placeholder="Search employees..."
        defaultValue={q}
        onChange={(e) => push({ q: e.target.value })}
        className="w-full sm:w-56"
      />
    </div>
  );
}
