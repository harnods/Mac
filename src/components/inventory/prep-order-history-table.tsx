"use client";

import { useState } from "react";
import Link from "next/link";
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
import { formatDate } from "@/lib/format";
import { VarianceIcon } from "@/components/prep-orders/variance-icon";

type PrepOrder = {
  id: string;
  status: string;
  target_qty: number | null;
  qty_to_prep: number | null;
  yield_variance_reason: string | null;
  planned_date: string;
};

export function PrepOrderHistoryTable({ orders, itemUnit }: { orders: PrepOrder[]; itemUnit: string }) {
  const [q, setQ] = useState("");
  const filtered = orders.filter((order) =>
    order.id.slice(0, 8).toUpperCase().includes(q.toUpperCase()) ||
    formatDate(order.planned_date).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Input
          placeholder="Search prep orders..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full sm:w-56"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No matching prep orders.</p>
      ) : (
        <div className="border table-outer rounded-lg overflow-x-auto">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[160px]">No</TableHead>
                <TableHead className="min-w-[240px]">Date</TableHead>
                <TableHead className="min-w-[160px]">Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="text-sm font-medium tabular-nums">
                    <Link href={`/prep-orders/${order.id}`} className="hover:underline">
                      {order.id.slice(0, 8).toUpperCase()}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(order.planned_date)}</TableCell>
                  <TableCell className="tabular-nums text-sm">
                    {order.qty_to_prep != null ? (
                      <span className="flex items-center gap-1.5">
                        <Qty value={order.qty_to_prep} unit={itemUnit} />
                        {order.target_qty != null && order.qty_to_prep !== order.target_qty && (
                          <VarianceIcon
                            targetQty={order.target_qty}
                            actualQty={order.qty_to_prep}
                            unit={itemUnit}
                            reason={order.yield_variance_reason}
                          />
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
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
