"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { ColumnsMenu } from "@/components/ui/columns-menu";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { ATTENDANCE_COLUMNS } from "@/components/employees/attendance-table";

export function AttendanceFilter() {
  const { isVisible, toggle } = useColumnVisibility("attendance", ATTENDANCE_COLUMNS);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();

  const q = params.get("q") ?? "";

  const push = useCallback(
    (value: string) => {
      const sp = new URLSearchParams(params.toString());
      if (value === "") sp.delete("q");
      else sp.set("q", value);
      sp.delete("page");
      start(() => router.replace(`${pathname}?${sp.toString()}`, { scroll: false }));
    },
    [params, pathname, router],
  );

  return (
    <div className="flex items-center justify-end gap-2">
      <ColumnsMenu columns={ATTENDANCE_COLUMNS} isVisible={isVisible} toggle={toggle} />
      <Input
        placeholder="Search crew..."
        defaultValue={q}
        onChange={(e) => push(e.target.value)}
        className="w-full sm:w-56"
      />
    </div>
  );
}
