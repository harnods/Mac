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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Qty } from "@/components/ui/qty";
import { formatDate } from "@/lib/format";
import type { UnitCode } from "@/lib/supabase/types";
import { UnitConversionsPanel, type UnitConversionRow } from "@/components/inventory/unit-conversions-panel";
import { RecipeDrawerTrigger } from "@/components/recipes/recipe-drawer";

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

type Tab = "stock" | "recipes" | "conversions";

export function ItemUsageTabs({
  ledger,
  itemUnit,
  usedInRecipes,
  unitConversions,
  itemId,
  canEditConversions = false,
}: {
  ledger: LedgerRow[];
  itemUnit: UnitCode;
  usedInRecipes?: UsedInRecipeRow[];
  unitConversions?: UnitConversionRow[];
  itemId?: string;
  canEditConversions?: boolean;
}) {
  const hasRecipeTab = usedInRecipes !== undefined;
  const hasConversionTab = unitConversions !== undefined && itemId !== undefined;
  const [tab, setTab] = useState<Tab>("stock");

  if (!hasRecipeTab && !hasConversionTab) {
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
          {hasConversionTab && (
            <TabButton active={tab === "conversions"} onClick={() => setTab("conversions")}>
              Unit conversions
            </TabButton>
          )}
        </div>
      </div>

      {tab === "stock" ? (
        <StockMovementsTable ledger={ledger} itemUnit={itemUnit} />
      ) : tab === "recipes" && hasRecipeTab ? (
        <UsedInRecipesTable recipes={usedInRecipes} />
      ) : hasConversionTab ? (
        <UnitConversionsPanel
          itemId={itemId}
          itemUnit={itemUnit}
          conversions={unitConversions}
          canEdit={canEditConversions}
        />
      ) : null}
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
  const [q, setQ] = useState("");

  if (ledger.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-sm text-muted-foreground">
        No transactions recorded yet.
      </div>
    );
  }

  const filtered = ledger.filter((row) => {
    const label = TYPE_LABEL[row.type] ?? row.type;
    return (
      label.toLowerCase().includes(q.toLowerCase()) ||
      (row.note ?? "").toLowerCase().includes(q.toLowerCase())
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Input
          placeholder="Search movements..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full sm:w-56"
        />
      </div>
      {filtered.length === 0 ? (
        <div className="border rounded-lg p-8 text-center text-sm text-muted-foreground">
          No matching transactions.
        </div>
      ) : (
      <div className="border table-outer rounded-lg overflow-x-auto">
      <Table className="w-full">
        <TableHeader>
          <TableRow>
            <TableHead className="w-32">Date</TableHead>
            <TableHead className="w-28">Number</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="w-28 text-right">Qty</TableHead>
            <TableHead className="w-28 text-right">On hand</TableHead>
            <TableHead className="w-28 text-right">Reserved</TableHead>
            <TableHead className="w-28 text-right">Available</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((row) => {
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
      )}
    </div>
  );
}

function UsedInRecipesTable({ recipes }: { recipes: UsedInRecipeRow[] }) {
  const [q, setQ] = useState("");

  if (recipes.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-sm text-muted-foreground">
        This ingredient is not used in any recipes yet.
      </div>
    );
  }

  const filtered = recipes.filter((recipe) =>
    recipe.name.toLowerCase().includes(q.toLowerCase()) ||
    (recipe.product?.name ?? "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Input
          placeholder="Search recipes..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full sm:w-56"
        />
      </div>
      {filtered.length === 0 ? (
        <div className="border rounded-lg p-8 text-center text-sm text-muted-foreground">
          No matching recipes.
        </div>
      ) : (
      <div className="border table-outer rounded-lg overflow-x-auto">
      <Table className="w-full">
        <TableHeader>
          <TableRow>
            <TableHead>Recipe</TableHead>
            <TableHead className="w-36">Type</TableHead>
            <TableHead className="w-48">Output</TableHead>
            <TableHead className="w-28 text-right">Qty</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((recipe) => (
            <TableRow key={`${recipe.id}-${recipe.unit}-${recipe.quantity}`}>
              <TableCell className="font-medium">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="truncate">{recipe.name}</span>
                  <RecipeDrawerTrigger
                    recipeId={recipe.id}
                    recipeName={recipe.name}
                    trigger={(onClick) => (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={onClick}
                        className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Preview
                      </Button>
                    )}
                  />
                </span>
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
      )}
    </div>
  );
}
