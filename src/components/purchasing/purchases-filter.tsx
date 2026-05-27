"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";

export function PurchasesFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, start] = useTransition();

  function handleSearch(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) params.set("q", value.trim());
    else params.delete("q");
    start(() => router.replace(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="flex justify-end">
      <Input
        placeholder="Search purchases..."
        defaultValue={searchParams.get("q") ?? ""}
        onChange={(e) => handleSearch(e.target.value)}
        className="max-w-xs"
      />
    </div>
  );
}
