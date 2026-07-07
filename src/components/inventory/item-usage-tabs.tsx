"use client";

import Link from "next/link";
import { useState } from "react";
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
import type { UnitCode } from "@/lib/supabase/types";

const TYPE_LABEL: Record<string, string> = {
  purchase: "Purchase",
  pr_approved: "PR Approved",
  pr_rejected: "PR Rejected",
  adjustment_in: "Stock in",
  adjustment_out: "Stock out",
  prep_consumption: "Prep consumption",
  prep_output: "Prep output",
  count_adjustment: "Stock count",
  reservation: "Reservation",
  reservation_release: "Reservation release",
};

const TYPE_HREF: Record<string, (refId: string) => string> = {
  purchase: (id) => `/purchasing/purchases/${id}`,
  pr_approved: (id) => `/purchasing/requests/${id}`,
  pr_rejected: (id) => `/purchasing/requests/${id}`,
  prep_consumption: (id) => `/prep-orders/${id}`,
  prep_output: (id) => `/prep-orders/${id}`,
  count_adjustment: (id) => `/stock/counts/${id}`,
};

export type LedgerRow = {
  id: string;
  type: string;
  ref_id: string | null;
  qty_delta: number;
  on_hand_after: number;
  reserved_after: number;
  note: string | null;
  created_at: string;
};

export type UsedInRecipeRow = {
  id: string;
  name: string;
  recipeType: string;
  quantity: number;
  unit: UnitCode;
  product: { id: string; name: string; type: string; unit: UnitCode } | null;
};

type Tab = "stock" | "recipes";

export function ItemUsageTabs({
  ledger,
  itemUnit,
  usedInRecipes,
}: {
  ledger: LedgerRow[];
  itemUnit: UnitCode;
  usedInRecipes?: UsedInRecipeRow[];
}) {
  const hasRecipeTab = usedInRecipes !== undefined;
  const [tab, setTab] = useState<Tab>("stock");

  if (!hasRecipeTab) {
    return (
      <div className="space-y-2">
        <h2 className="text-sm font-medium">Stock movements</h2>
        <StockMovementsTable ledger={ledger} itemUnit={itemUnit} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="border-b">
        <div className="flex items-center gap-4">
          <TabButton active={tab === "stock"} onClick={() => setTab("stock")}>
            Stock movements
          </TabButton>
          <TabButton active={tab === "recipes"} onClick={() => setTab("recipes")}>
            Used in recipes
          </TabButton>
        </div>
      </div>

      {tab === "stock" ? (
        <StockMovementsTable ledger={ledger} itemUnit={itemUnit} />
      ) : (
        <UsedInRecipesTable recipes={usedInRecipes} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "-mb-px border-b-2 px-0 py-2 text-sm font-medium transition-colors",
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function StockMovementsTable({
  ledger,
  itemUnit,
}: {
  ledger: LedgerRow[];
  itemUnit: UnitCode;
}) {
  if (ledger.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-sm text-muted-foreground">
        No transactions recorded yet.
      </div>
    );
  }

  return (
    <div className="border table-outer rounded-lg overflow-x-auto">
      <Table className="w-full">
        <TableHeader>
          <TableRow>
            <TableHead className="w-32">Date</TableHead>
            <TableHead className="w-28">Number</TableHead>
            <TableHead className="w-28">Type</TableHead>
            <TableHead className="w-28 text-right">Qty</TableHead>
            <TableHead className="w-28 text-right">On hand</TableHead>
            <TableHead className="w-28 text-right">Reserved</TableHead>
            <TableHead className="w-28 text-right">Available</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ledger.map((row) => {
            const availableAfter = Number(row.on_hand_after) - Number(row.reserved_after);
            const delta = Number(row.qty_delta);
            const href = row.ref_id && TYPE_HREF[row.type]
              ? TYPE_HREF[row.type](row.ref_id)
              : null;

            return (
              <TableRow key={row.id}>
                <TableCell className="text-sm">{formatDate(row.created_at)}</TableCell>
                <TableCell className="text-sm font-medium tabular-nums">
                  {href && row.ref_id ? (
                    <Link href={href} className="underline text-muted-foreground hover:text-foreground">
                      #{row.ref_id.slice(0, 8)}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  <div>{TYPE_LABEL[row.type] ?? row.type}</div>
                  {row.note && <div className="text-xs text-muted-foreground">{row.note}</div>}
                </TableCell>
                <TableCell className={`text-sm tabular-nums text-right font-medium ${delta >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {delta >= 0 ? "+" : ""}<Qty value={Math.abs(delta)} unit={itemUnit} />
                </TableCell>
                <TableCell className="text-sm tabular-nums text-right">
                  <Qty value={Number(row.on_hand_after)} unit={itemUnit} />
                </TableCell>
                <TableCell className="text-sm tabular-nums text-right">
                  <Qty value={Number(row.reserved_after)} unit={itemUnit} />
                </TableCell>
                <TableCell className="text-sm tabular-nums text-right">
                  <Qty value={availableAfter} unit={itemUnit} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function UsedInRecipesTable({ recipes }: { recipes: UsedInRecipeRow[] }) {
  if (recipes.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-sm text-muted-foreground">
        This ingredient is not used in any recipes yet.
      </div>
    );
  }

  return (
    <div className="border table-outer rounded-lg overflow-x-auto">
      <Table className="w-full">
        <TableHeader>
          <TableRow>
            <TableHead className="w-64">Recipe</TableHead>
            <TableHead className="w-36">Type</TableHead>
            <TableHead className="w-48">Output</TableHead>
            <TableHead className="w-28 text-right">Qty</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recipes.map((recipe) => (
            <TableRow key={`${recipe.id}-${recipe.unit}-${recipe.quantity}`}>
              <TableCell className="font-medium">
                <Link href={`/recipes/${recipe.id}`} className="hover:underline">
                  {recipe.name}
                </Link>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {recipe.recipeType === "product" ? "Product" : "Prep item"}
              </TableCell>
              <TableCell className="text-sm">
                {recipe.product ? (
                  <Link
                    href={`/inventory/${recipe.product.type === "product" ? "products" : "prep-items"}/${recipe.product.id}`}
                    className="hover:underline"
                  >
                    {recipe.product.name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm tabular-nums text-right">
                <Qty value={recipe.quantity} unit={recipe.unit} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
