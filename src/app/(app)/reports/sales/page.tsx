import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P, canViewCost } from "@/lib/permissions";
import { AccessDenied } from "@/components/access-denied";
import { convert } from "@/lib/units";
import { effectiveUnitCost } from "@/lib/cogs";
import { formatRp } from "@/lib/format";
import { Qty } from "@/components/ui/qty";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ReportDateFilter } from "@/components/reports/report-date-filter";

export const dynamic = "force-dynamic";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type Recipe = {
  product_id: string;
  yield_qty: number;
  recipe_type: string;
  recipe_items: {
    item_id: string;
    quantity: number;
    unit: string;
    item: {
      id: string; name: string; unit: string; type: string;
      avg_purchase_cost: number | null; last_purchase_cost: number | null;
      default_purchase_cost: number | null; default_purchase_cost_unit: string | null;
      purchase_unit: string | null; purchase_unit_qty: number | null;
    } | null;
  }[];
};

export default async function SalesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!can(profile, P.SALES_READ)) return <AccessDenied label="Sales report" />;
  const viewCost = canViewCost(profile);

  const sp = await searchParams;
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : isoDaysAgo(29);
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : todayIso();

  const supabase = await createClient();

  const { data: entriesData } = await supabase
    .from("sales_entries")
    .select("id, entry_date, gross_sales, total_discount, service_charge, tax_total, net_sales")
    .gte("entry_date", from)
    .lte("entry_date", to)
    .order("entry_date");
  const entries = (entriesData ?? []) as { id: string; entry_date: string; gross_sales: number; total_discount: number; service_charge: number; tax_total: number; net_sales: number }[];
  const entryIds = entries.map((e) => e.id);

  const summary = entries.reduce(
    (acc, e) => ({
      gross: acc.gross + Number(e.gross_sales),
      discount: acc.discount + Number(e.total_discount),
      sc: acc.sc + Number(e.service_charge),
      tax: acc.tax + Number(e.tax_total),
      net: acc.net + Number(e.net_sales),
    }),
    { gross: 0, discount: 0, sc: 0, tax: 0, net: 0 },
  );
  const daysWithSales = new Set(entries.map((e) => e.entry_date)).size;

  // Line items across all entries in range
  const { data: itemRows } = entryIds.length
    ? await supabase.from("sales_entry_items").select("product_id, qty, unit").in("entry_id", entryIds)
    : { data: [] };
  const lines = (itemRows ?? []) as { product_id: string; qty: number; unit: string }[];
  const productIds = [...new Set(lines.map((l) => l.product_id))];

  const { data: productRows } = productIds.length
    ? await supabase.from("items").select("id, name, unit, sell_price").in("id", productIds)
    : { data: [] };
  const products = new Map((productRows ?? []).map((p: { id: string; name: string; unit: string; sell_price: number | null }) => [p.id, p]));

  const { data: recipeRows } = productIds.length
    ? await supabase
        .from("recipes")
        .select("product_id, yield_qty, recipe_type, recipe_items(item_id, quantity, unit, item:items(id, name, unit, type, avg_purchase_cost, last_purchase_cost, default_purchase_cost, default_purchase_cost_unit, purchase_unit, purchase_unit_qty))")
        .in("product_id", productIds)
    : { data: [] };
  const recipeMap = new Map<string, Recipe>();
  for (const r of (recipeRows ?? []) as unknown as Recipe[]) recipeMap.set(r.product_id, r);

  // Top products (qty + revenue)
  const perProduct = new Map<string, { name: string; unit: string; qty: number; revenue: number }>();
  for (const l of lines) {
    const p = products.get(l.product_id);
    if (!p) continue;
    const cur = perProduct.get(l.product_id) ?? { name: p.name, unit: p.unit, qty: 0, revenue: 0 };
    cur.qty += Number(l.qty);
    cur.revenue += Number(l.qty) * Number(p.sell_price ?? 0);
    perProduct.set(l.product_id, cur);
  }
  const topProducts = [...perProduct.values()].sort((a, b) => b.revenue - a.revenue);

  // Ingredient usage from recipes (mirrors the sales-consumption logic)
  // Cost per the item's base unit — effectiveUnitCost converts a default cost
  // that's denominated in another unit (e.g. Rp350.000/kg for a gram-based item).
  const unitCost = (it: Recipe["recipe_items"][number]["item"]) =>
    it ? (effectiveUnitCost(it)?.value ?? null) : null;
  const usage = new Map<string, { name: string; unit: string; qty: number; cost: number | null }>();
  const addUsage = (id: string, name: string, unit: string, qtyBase: number, cost: number | null) => {
    const cur = usage.get(id) ?? { name, unit, qty: 0, cost: cost != null ? 0 : null };
    cur.qty += qtyBase;
    if (cost != null && cur.cost != null) cur.cost += qtyBase * cost;
    else if (cost == null) cur.cost = null; // incomplete cost data
    usage.set(id, cur);
  };
  for (const l of lines) {
    const recipe = recipeMap.get(l.product_id);
    const product = products.get(l.product_id);
    if (!recipe || !recipe.yield_qty || !product) continue;
    const qtyInProductBase = convert(Number(l.qty), l.unit, product.unit) ?? Number(l.qty);
    if (recipe.recipe_type === "wip") {
      // Selling a prep item draws down the already-prepped stock directly.
      addUsage(l.product_id, product.name, product.unit, qtyInProductBase, null);
      continue;
    }
    for (const ri of recipe.recipe_items) {
      if (!ri.item) continue;
      const recipeQtyInBase = convert(Number(ri.quantity), ri.unit, ri.item.unit) ?? Number(ri.quantity);
      const neededBase = (recipeQtyInBase / recipe.yield_qty) * qtyInProductBase;
      addUsage(ri.item.id, ri.item.name, ri.item.unit, neededBase, unitCost(ri.item));
    }
  }
  const ingredientUsage = [...usage.values()].sort((a, b) => a.name.localeCompare(b.name));
  const totalCogs = ingredientUsage.reduce((s, u) => s + (u.cost ?? 0), 0);
  const cogsComplete = ingredientUsage.every((u) => u.cost != null);
  const margin = summary.net > 0 ? ((summary.net - totalCogs) / summary.net) * 100 : null;

  const tile = (label: string, value: string, sub?: string) => (
    <div className="rounded-lg border p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Sales report</h1>
        <ReportDateFilter from={from} to={to} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {tile("Net sales", formatRp(summary.net))}
        {tile("Gross sales", formatRp(summary.gross))}
        {tile("Discount", formatRp(summary.discount))}
        {tile("Service charge", formatRp(summary.sc))}
        {tile("Tax (PB1)", formatRp(summary.tax))}
        {tile("Entries", String(entries.length), `${daysWithSales} day(s)`)}
      </div>

      {viewCost && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {tile("Est. COGS", cogsComplete ? formatRp(totalCogs) : `${formatRp(totalCogs)}*`, cogsComplete ? undefined : "*some ingredients missing cost")}
          {tile("Est. gross profit", formatRp(summary.net - totalCogs))}
          {tile("Est. margin", margin != null ? `${margin.toFixed(1)}%` : "—")}
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Ingredient usage (from recipes)</h2>
        {ingredientUsage.length === 0 ? (
          <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">No sales in this range.</div>
        ) : (
          <div className="table-outer overflow-x-auto rounded-lg border">
            <Table className="w-auto min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[280px]">Ingredient / prep item</TableHead>
                  <TableHead className="text-right w-[160px]">Qty used</TableHead>
                  {viewCost && <TableHead className="text-right w-[160px]">Est. cost</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredientUsage.map((u) => (
                  <TableRow key={u.name}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-right tabular-nums"><Qty value={u.qty} unit={u.unit} /></TableCell>
                    {viewCost && <TableCell className="text-right tabular-nums">{u.cost != null ? formatRp(u.cost) : <span className="text-muted-foreground">—</span>}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Top products</h2>
        {topProducts.length === 0 ? (
          <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">No products sold in this range.</div>
        ) : (
          <div className="table-outer overflow-x-auto rounded-lg border">
            <Table className="w-auto min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[280px]">Product</TableHead>
                  <TableHead className="text-right w-[140px]">Qty sold</TableHead>
                  <TableHead className="text-right w-[160px]">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.map((p) => (
                  <TableRow key={p.name}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-right tabular-nums"><Qty value={p.qty} unit={p.unit} /></TableCell>
                    <TableCell className="text-right tabular-nums">{formatRp(p.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
