"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition, useCallback } from "react";
import { Input } from "@/components/ui/input";

export function CategoriesFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();
  const q = params.get("q") ?? "";

  const push = useCallback(
    (val: string) => {
      const sp = new URLSearchParams(params.toString());
      if (val) sp.set("q", val); else sp.delete("q");
      start(() => router.replace(`${pathname}?${sp.toString()}`, { scroll: false }));
    },
    [params, pathname, router],
  );

  return (
    <div className="flex items-center justify-end">
      <Input
        placeholder="Search categories..."
        defaultValue={q}
        onChange={(e) => push(e.target.value)}
        className="w-full sm:w-56"
      />
    </div>
  );
}
