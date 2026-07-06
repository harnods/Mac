"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { ColumnsMenu } from "@/components/ui/columns-menu";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { PURCHASE_COLUMNS } from "@/components/purchasing/purchases-table";

export function PurchasesFilter() {
  const { isVisible, toggle } = useColumnVisibility("purchases", PURCHASE_COLUMNS);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, start] = useTransition();

  function handleSearch(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) params.set("q", value.trim());
    else params.delete("q");
    params.delete("page");
    start(() => router.replace(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="flex justify-end gap-2">
      <ColumnsMenu columns={PURCHASE_COLUMNS} isVisible={isVisible} toggle={toggle} />
      <Input
        placeholder="Search purchases..."
        defaultValue={searchParams.get("q") ?? ""}
        onChange={(e) => handleSearch(e.target.value)}
        className="max-w-xs"
      />
    </div>
  );
}
