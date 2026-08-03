"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNum } from "@/lib/units";

type SalesEntryItem = {
  id: string;
  qty: number;
  unit: string;
  product: { id: string; name: string } | null;
};

export function SalesEntryItemsTable({ items }: { items: SalesEntryItem[] }) {
  const [q, setQ] = useState("");
  const filtered = items.filter((item) => (item.product?.name ?? "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Input
          placeholder="Search products..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full sm:w-56"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No matching products.</p>
      ) : (
        <div className="border table-outer rounded-lg overflow-x-auto">
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="w-36">Qty sold</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground text-sm tabular-nums">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="text-sm font-medium truncate">
                    {item.product?.name ?? "—"}
                  </TableCell>
                  <TableCell className="tabular-nums text-sm">
                    {formatNum(item.qty)} {item.unit}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
