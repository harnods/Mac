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

type RecipeIngredient = {
  id: string;
  quantity: number;
  unit: string;
  item: { id: string; name: string; deleted_at: string | null } | null;
};

export function LinkedRecipeIngredientsTable({ ingredients }: { ingredients: RecipeIngredient[] }) {
  const [q, setQ] = useState("");
  const filtered = ingredients.filter((ri) =>
    (ri.item?.name ?? "").toLowerCase().includes(q.toLowerCase())
  );

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
        <p className="text-sm text-muted-foreground py-2">No ingredients found.</p>
      ) : (
        <div className="border table-outer rounded-lg overflow-x-auto">
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Ingredient</TableHead>
                <TableHead className="w-28">Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((ri, idx) => (
                <TableRow key={ri.id}>
                  <TableCell className="text-muted-foreground text-sm tabular-nums">{idx + 1}</TableCell>
                  <TableCell className="text-sm font-medium">
                    {ri.item ? (
                      <Link href={`/inventory/ingredients/${ri.item.id}`} className="hover:underline">
                        {ri.item.name}
                      </Link>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    <Qty value={ri.quantity} unit={ri.unit} />
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
