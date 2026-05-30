"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function PurchaseRequestsFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, start] = useTransition();
  const status = searchParams.get("status") ?? "";
  const q = searchParams.get("q") ?? "";

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    start(() => router.replace(`${pathname}?${params.toString()}`));
  }

  const hasFilter = !!status;

  return (
    <div className="flex items-center gap-2">
      <Select value={status} onValueChange={(v) => update("status", v === "all" ? "" : v)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="draft">Draft</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
        </SelectContent>
      </Select>
      {hasFilter && (
        <Button variant="ghost" size="sm" onClick={() => update("status", "")}>
          Clear
        </Button>
      )}
      <div className="flex-1" />
      <Input
        placeholder="Search requests..."
        defaultValue={q}
        onChange={(e) => update("q", e.target.value)}
        className="max-w-xs"
      />
    </div>
  );
}
