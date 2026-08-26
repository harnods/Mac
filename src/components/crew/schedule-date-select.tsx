"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ScheduleDateSelect({
  value,
  options,
}: {
  value: string;
  options: { key: string; label: string }[];
}) {
  const router = useRouter();
  return (
    <Select value={value} onValueChange={(v) => router.push(`/me/schedule?tab=all&date=${v}`)}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.key} value={o.key}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
