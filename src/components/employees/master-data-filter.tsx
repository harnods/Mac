"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { ColumnsMenu } from "@/components/ui/columns-menu";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { getMasterDataColumns, masterDataTableId } from "@/components/employees/master-data-manager";

export function MasterDataFilter({
  placeholder = "Search...",
  title,
  showSortOrder = false,
}: {
  placeholder?: string;
  title: string;
  showSortOrder?: boolean;
}) {
  const columns = getMasterDataColumns(showSortOrder);
  const { isVisible, toggle } = useColumnVisibility(masterDataTableId(title), columns);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();

  const push = useCallback(
    (val: string) => {
      const sp = new URLSearchParams(params.toString());
      if (val.trim()) sp.set("q", val.trim()); else sp.delete("q");
      start(() => router.replace(`${pathname}?${sp.toString()}`, { scroll: false }));
    },
    [params, pathname, router],
  );

  return (
    <div className="flex justify-end gap-2">
      <ColumnsMenu columns={columns} isVisible={isVisible} toggle={toggle} />
      <Input
        placeholder={placeholder}
        defaultValue={params.get("q") ?? ""}
        onChange={(e) => push(e.target.value)}
        className="w-full sm:w-56"
      />
    </div>
  );
}
