"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Minus, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatRp } from "@/lib/format";
import { calculateOrderCharges, formatRate, PBJT_RATE, SERVICE_CHARGE_RATE } from "@/lib/order-charges";
import { createCustomerOrder } from "@/app/actions/orders";

export type ManualItem = { id: string; name: string; price: number; imageUrl: string | null };
export type ManualCategory = { name: string; items: ManualItem[] };
export type TableInfo = { id: string; name: string; code: string };

export function ManualOrderClient({
  categories,
  table,
}: {
  categories: ManualCategory[];
  table: TableInfo;
}) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [submitting, startSubmit] = useTransition();

  const allItems = useMemo(
    () => Object.fromEntries(categories.flatMap((c) => c.items).map((i) => [i.id, i])),
    [categories],
  );

  const setQty = (id: string, delta: number) =>
    setCart((prev) => {
      const next = Math.max(0, (prev[id] ?? 0) + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });

  const filteredCategories = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return categories
      .filter((c) => activeCat === "all" || c.name === activeCat)
      .map((c) => ({
        ...c,
        items: needle ? c.items.filter((i) => i.name.toLowerCase().includes(needle)) : c.items,
      }))
      .filter((c) => c.items.length > 0);
  }, [categories, q, activeCat]);

  const lines = Object.entries(cart);
  const totalQty = lines.reduce((s, [, qty]) => s + qty, 0);
  const subtotal = lines.reduce((s, [id, qty]) => s + (allItems[id]?.price ?? 0) * qty, 0);
  const charges = calculateOrderCharges(subtotal);

  function placeOrder() {
    if (totalQty === 0) return;
    startSubmit(async () => {
      const res = await createCustomerOrder({
        tableId: table.id,
        notes: notes.trim() || undefined,
        items: lines.map(([item_id, qty]) => ({ item_id, qty })),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Order ${res.orderNumber} dibuat untuk ${table.name}`);
      router.push("/orders");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/orders")}>
          <ArrowLeft className="size-4" /> POS
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight leading-none">Manual order</h1>
          <p className="mt-1 text-sm text-muted-foreground">{table.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        {/* ── Menu ─────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari menu..."
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            <CatChip label="Semua" active={activeCat === "all"} onClick={() => setActiveCat("all")} />
            {categories.map((c) => (
              <CatChip key={c.name} label={c.name} active={activeCat === c.name} onClick={() => setActiveCat(c.name)} />
            ))}
          </div>

          {filteredCategories.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
              Tidak ada produk yang cocok.
            </div>
          ) : (
            filteredCategories.map((cat) => (
              <section key={cat.name} className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{cat.name}</h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {cat.items.map((item) => {
                    const qty = cart[item.id] ?? 0;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setQty(item.id, 1)}
                        className={`group relative flex flex-col rounded-lg border p-2 text-left transition-colors hover:border-primary hover:bg-accent ${qty > 0 ? "border-primary ring-1 ring-primary" : ""}`}
                      >
                        <div className="mb-2 aspect-square w-full overflow-hidden rounded-md bg-muted">
                          {item.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.imageUrl} alt={item.name} className="size-full object-cover" />
                          )}
                        </div>
                        <div className="line-clamp-2 text-sm font-medium leading-tight">{item.name}</div>
                        <div className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                          {item.price > 0 ? formatRp(item.price) : "—"}
                        </div>
                        {qty > 0 && (
                          <Badge className="absolute right-1.5 top-1.5 size-6 justify-center rounded-full p-0 tabular-nums">
                            {qty}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>

        {/* ── Cart ─────────────────────────────────────────── */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-lg border bg-card">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <ShoppingCart className="size-4" />
              <span className="text-sm font-semibold">Pesanan</span>
              <Badge variant="secondary" className="ml-auto tabular-nums">{totalQty}</Badge>
            </div>

            {lines.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                Pilih menu untuk mulai pesanan.
              </div>
            ) : (
              <div className="max-h-[45vh] divide-y overflow-y-auto">
                {lines.map(([id, qty]) => {
                  const item = allItems[id];
                  if (!item) return null;
                  return (
                    <div key={id} className="flex items-center gap-2 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {item.price > 0 ? `${formatRp(item.price)} × ${qty}` : "—"}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button size="icon" variant="outline" className="size-7" onClick={() => setQty(id, -1)}>
                          <Minus className="size-3.5" />
                        </Button>
                        <span className="w-5 text-center text-sm font-medium tabular-nums">{qty}</span>
                        <Button size="icon" variant="outline" className="size-7" onClick={() => setQty(id, 1)}>
                          <Plus className="size-3.5" />
                        </Button>
                      </div>
                      <div className="w-20 shrink-0 text-right text-sm font-medium tabular-nums">
                        {item.price > 0 ? formatRp(item.price * qty) : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {lines.length > 0 && (
              <>
                <Separator />
                <div className="space-y-1.5 px-4 py-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">{formatRp(charges.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Service charge ({formatRate(SERVICE_CHARGE_RATE)})</span>
                    <span className="tabular-nums">{formatRp(charges.serviceCharge)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">PBJT ({formatRate(PBJT_RATE)})</span>
                    <span className="tabular-nums">{formatRp(charges.taxTotal)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1.5 text-base font-bold">
                    <span>Total</span>
                    <span className="tabular-nums">{formatRp(charges.total)}</span>
                  </div>
                </div>

                <div className="space-y-2 px-4 pb-4">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Catatan (opsional)"
                    className="resize-none text-sm"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setCart({})} title="Kosongkan">
                      <Trash2 className="size-4" />
                    </Button>
                    <Button className="flex-1" onClick={placeOrder} disabled={submitting || totalQty === 0}>
                      {submitting ? "Menyimpan..." : `Buat pesanan · ${formatRp(charges.total)}`}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CatChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
      }`}
    >
      {label}
    </button>
  );
}
