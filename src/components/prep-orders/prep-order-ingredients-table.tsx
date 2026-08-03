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
import { Qty } from "@/components/ui/qty";

type PrepOrderItem = {
  id: string;
  item_id: string;
  qty_needed: number;
  unit: string;
  item: { id: string; name: string } | null;
};

export function PrepOrderIngredientsTable({
  items,
  columnLabel,
}: {
  items: PrepOrderItem[];
  columnLabel: string;
}) {
  const [q, setQ] = useState("");
  const filtered = items.filter((oi) => (oi.item?.name ?? "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Input
          placeholder="Search ingredients..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full sm:w-56"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No matching ingredients.</p>
      ) : (
        <div className="border table-outer rounded-lg overflow-x-auto">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead className="min-w-[240px]">Ingredient</TableHead>
                <TableHead className="min-w-[160px]">{columnLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((oi, idx) => (
                <TableRow key={oi.id}>
                  <TableCell className="text-muted-foreground text-sm tabular-nums">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="text-sm font-medium truncate">
                    {oi.item?.name ?? "—"}
                  </TableCell>
                  <TableCell className="tabular-nums text-sm">
                    <Qty value={oi.qty_needed} unit={oi.unit} />
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
