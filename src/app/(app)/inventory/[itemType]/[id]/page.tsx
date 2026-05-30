import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ItemFormDialog } from "@/components/inventory/item-form-dialog";
import { ItemStockSection } from "@/components/inventory/item-stock-section";
import { ArrowLeft } from "lucide-react";
import { formatQty } from "@/lib/units";
import { Qty } from "@/components/ui/qty";
import { formatDate, updaterName } from "@/lib/format";
import { ItemActions } from "@/components/inventory/item-actions";
import { ProductStatusButton } from "@/components/inventory/product-status-button";
import { ITEM_TYPE_CONFIG, type ItemTypeSlug } from "@/lib/item-types";
import type { ItemWithCategory } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

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

type LedgerRow = {
  id: string;
  type: string;
  ref_id: string | null;
  qty_delta: number;
  on_hand_after: number;
  reserved_after: number;
  note: string | null;
  created_at: string;
};

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ itemType: string; id: string }>;
}) {
  const { itemType, id } = await params;
  const config = ITEM_TYPE_CONFIG[itemType as ItemTypeSlug];
  if (!config) notFound();

  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const [{ data, error }, { data: ledgerData }, { data: setItemsData }, { data: recipeData }] = await Promise.all([
    supabase
      .from("items")
      .select("*, categories(id,name), updater:profiles!updated_by(full_name,email)")
      .eq("id", id)
      .eq("type", config.dbType)
      .maybeSingle(),
    config.stockMode !== 'none'
      ? supabase
          .from("stock_ledger")
          .select("id, type, ref_id, qty_delta, on_hand_after, reserved_after, note, created_at")
          .eq("item_id", id)
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
    config.dbType === 'product'
      ? supabase
          .from("product_set_items")
          .select("product_id, qty, product:items!product_id(id, name, unit)")
          .eq("set_id", id)
      : Promise.resolve({ data: [] }),
    config.dbType === 'product'
      ? supabase
          .from("recipes")
          .select("id, name, recipe_items(id, quantity, unit, item:items!item_id(id, name, deleted_at))")
          .eq("product_id", id)
          .eq("recipe_type", "product")
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (error || !data) notFound();
  const item = data as ItemWithCategory & { product_kind?: string; status?: string };
  const isAdmin = can(profile, P.INVENTORY_WRITE);
  const ledger = (ledgerData ?? []) as LedgerRow[];
  const setItems = (setItemsData ?? []) as unknown as { product_id: string; qty: number; product: { id: string; name: string; unit: string } | null }[];

  type RecipeIngredient = { id: string; quantity: number; unit: string; item: { id: string; name: string; deleted_at: string | null } | null };
  type LinkedRecipe = { id: string; name: string; recipe_items: RecipeIngredient[] };
  const linkedRecipe = recipeData as LinkedRecipe | null;

  const onHand = Number(item.on_hand);
  const reserved = Number(item.reserved);
  const available = onHand - reserved;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild className="-ml-2 mt-0.5">
            <Link href={`/inventory/${itemType}`}><ArrowLeft className="size-4" /></Link>
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{item.name}</h1>
            {item.status === "draft" && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                Draft
              </span>
            )}
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            {config.dbType === "product" && item.status != null && (
              <ProductStatusButton
                id={id}
                status={(item.status ?? "active") as "active" | "draft"}
              />
            )}
            <ItemFormDialog
              itemTypeSlug={itemType as ItemTypeSlug}
              itemId={id}
              trigger={
                <Button size="sm" variant="outline">
                  Edit
                </Button>
              }
            />
            <ItemActions id={item.id} name={item.name} backUrl={`/inventory/${itemType}`} />
          </div>
        )}
      </div>

      <div className="max-w-2xl">
        <ItemStockSection
          baseUnit={item.unit}
          onHand={onHand}
          reserved={reserved}
          stockMode={config.stockMode}
          hasCategories={config.hasCategories}
          categoryName={item.categories?.name ?? null}
          lastPurchaseCost={item.last_purchase_cost}
          avgPurchaseCost={item.avg_purchase_cost}
          updatedAt={item.updated_at}
          updaterLabel={item.updater ? updaterName(item.updater) : null}
        />
      </div>

      {/* Recipe — product only */}
      {config.dbType === "product" && !linkedRecipe && isAdmin && (
        <div className="space-y-2 max-w-2xl">
          <h2 className="text-sm font-medium">Recipe</h2>
          <p className="text-sm text-muted-foreground">
            No recipe yet.{" "}
            <Link href={`/recipes/new?name=${encodeURIComponent(item.name)}&type=product`} className="underline hover:text-foreground">
              Create recipe
            </Link>
          </p>
        </div>
      )}
      {linkedRecipe && (
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium">Recipe</h2>
            <Link href={`/recipes/${linkedRecipe.id}`} className="text-xs text-muted-foreground hover:text-foreground underline">
              {linkedRecipe.name} →
            </Link>
          </div>
          {linkedRecipe.recipe_items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No ingredients in recipe.</p>
          ) : (
            <div className="border table-outer rounded-lg overflow-x-auto">
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Ingredient</TableHead>
                    <TableHead className="w-28">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkedRecipe.recipe_items.map((ri, idx) => (
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
      )}

      {/* Included products — set only */}
      {item.product_kind === "set" && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Included products</h2>
          {setItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No products in this set.</p>
          ) : (
            <div className="border table-outer rounded-lg overflow-x-auto">
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="w-28">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {setItems.map((si, idx) => (
                    <TableRow key={si.product_id}>
                      <TableCell className="text-muted-foreground text-sm tabular-nums">{idx + 1}</TableCell>
                      <TableCell className="text-sm font-medium">
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
      )}

      {/* Stock ledger — only for items with stock */}
      {config.stockMode !== 'none' && <div className="space-y-2">
        <h2 className="text-sm font-medium">Stock movements</h2>
        {ledger.length === 0 ? (
          <div className="border rounded-lg p-8 text-center text-sm text-muted-foreground">
            No transactions recorded yet.
          </div>
        ) : (
          <div className="border table-outer rounded-lg overflow-x-auto">
            <Table className="table-fixed w-full">
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
                        {delta >= 0 ? "+" : ""}<Qty value={Math.abs(delta)} unit={item.unit} />
                      </TableCell>
                      <TableCell className="text-sm tabular-nums text-right"><Qty value={Number(row.on_hand_after)} unit={item.unit} /></TableCell>
                      <TableCell className="text-sm tabular-nums text-right"><Qty value={Number(row.reserved_after)} unit={item.unit} /></TableCell>
                      <TableCell className="text-sm tabular-nums text-right"><Qty value={availableAfter} unit={item.unit} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>}
    </div>
  );
}
