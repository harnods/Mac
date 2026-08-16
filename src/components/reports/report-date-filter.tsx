"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ReportDateFilter({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, start] = useTransition();

  function setParam(key: "from" | "to", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    start(() => router.replace(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="flex items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor="from" className="text-xs text-muted-foreground">From</Label>
        <Input id="from" type="date" defaultValue={from} onChange={(e) => setParam("from", e.target.value)} className="h-9 w-[150px]" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="to" className="text-xs text-muted-foreground">To</Label>
        <Input id="to" type="date" defaultValue={to} onChange={(e) => setParam("to", e.target.value)} className="h-9 w-[150px]" />
      </div>
    </div>
  );
}
