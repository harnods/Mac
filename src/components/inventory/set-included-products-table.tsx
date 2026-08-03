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

type SetItem = {
  product_id: string;
  qty: number;
  product: { id: string; name: string; unit: string } | null;
};

export function SetIncludedProductsTable({ items }: { items: SetItem[] }) {
  const [q, setQ] = useState("");
  const filtered = items.filter((si) =>
    (si.product?.name ?? "").toLowerCase().includes(q.toLowerCase())
  );

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
        <p className="text-sm text-muted-foreground py-2">No products found.</p>
      ) : (
        <div className="border table-outer rounded-lg overflow-x-auto">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead className="min-w-[200px]">Product</TableHead>
                <TableHead className="min-w-[150px]">Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((si, idx) => (
                <TableRow key={si.product_id}>
                  <TableCell className="text-muted-foreground text-sm tabular-nums">{idx + 1}</TableCell>
                  <TableCell className="text-sm font-medium truncate">
                    {si.product ? (
                      <Link href={`/inventory/products/${si.product.id}`} className="hover:underline">
                        {si.product.name}
                      </Link>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {si.qty} {si.product?.unit ?? "pcs"}
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
