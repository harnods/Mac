"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Minus, Plus, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatRp } from "@/lib/format";
import { calculateOrderCharges, formatRate, PBJT_RATE, SERVICE_CHARGE_RATE } from "@/lib/order-charges";
import { createCustomerOrder } from "@/app/actions/orders";
import { toast } from "sonner";

export type MenuItem = { id: string; name: string; unit: string; price: number; imageUrl: string | null };
export type MenuCategory = { name: string; items: MenuItem[] };
export type TableInfo = { id: string; name: string; code: string };

export function MenuClient({ categories, table }: { categories: MenuCategory[]; table?: TableInfo }) {
  const router = useRouter();
  const [phone] = useState<string | null>(() => {
    if (table || typeof window === "undefined") return null;
    return sessionStorage.getItem("order_phone");
  });
  const [name] = useState(() => {
    if (table || typeof window === "undefined") return "";
    return sessionStorage.getItem("order_name") ?? "";
  });
  const [cart, setCart] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [view, setView] = useState<"menu" | "review">("menu");
  const [submitting, startSubmit] = useTransition();

  useEffect(() => {
    if (!table && !phone) router.replace("/order");
  }, [phone, router, table]);

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

  const lines = Object.entries(cart);
  const totalQty = lines.reduce((s, [, q]) => s + q, 0);
  const subtotal = lines.reduce((s, [id, q]) => s + (allItems[id]?.price ?? 0) * q, 0);
  const orderCharges = calculateOrderCharges(subtotal);

  function confirm() {
    if (totalQty === 0) return;
    if (!table && !phone) return;
    startSubmit(async () => {
      const res = await createCustomerOrder({
        phone: phone ?? undefined,
        name: name || undefined,
        tableId: table?.id,
        notes: notes.trim() || undefined,
        items: lines.map(([item_id, qty]) => ({ item_id, qty })),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (!table) {
        sessionStorage.removeItem("order_phone");
        sessionStorage.removeItem("order_name");
      }
      router.push(`/order/confirm/${res.id}`);
    });
  }

  if (!table && !phone) return null;

  // ── REVIEW SCREEN ──────────────────────────────────────────────
  if (view === "review") {
    return (
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b bg-background px-5 py-4 flex items-center gap-3">
          <button onClick={() => setView("menu")} className="p-1 -ml-1 rounded-md hover:bg-accent">
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Review Pesanan</h1>
            {table && <p className="text-sm text-muted-foreground">{table.name}</p>}
          </div>
        </header>

        <div className="flex-1 px-5 py-5 space-y-5 pb-32">
          <div className="divide-y rounded-lg border">
            {lines.map(([id, qty]) => {
              const item = allItems[id];
              if (!item) return null;
              return (
                <div key={id} className="flex items-center gap-3 px-4 py-3">
                  <div className="size-10 rounded-md bg-muted overflow-hidden shrink-0">
                    {item.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.name} className="size-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.name}</div>
                    {item.price > 0 && (
                      <div className="text-sm text-muted-foreground tabular-nums">
                        {formatRp(item.price)} × {qty}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="icon" variant="outline" className="size-8" onClick={() => setQty(id, -1)}>
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-5 text-center text-sm font-medium tabular-nums">{qty}</span>
                    <Button size="icon" variant="outline" className="size-8" onClick={() => setQty(id, 1)}>
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                  <div className="text-sm font-medium tabular-nums w-20 text-right shrink-0">
                    {item.price > 0 ? formatRp(item.price * qty) : "—"}
                  </div>
                </div>
              );
            })}
            <div className="flex justify-between px-4 py-3 text-sm">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatRp(orderCharges.subtotal)}</span>
            </div>
            <div className="flex justify-between px-4 py-3 text-sm">
              <span>Service charge ({formatRate(SERVICE_CHARGE_RATE)})</span>
              <span className="tabular-nums">{formatRp(orderCharges.serviceCharge)}</span>
            </div>
            <div className="flex justify-between px-4 py-3 text-sm">
              <span>PBJT ({formatRate(PBJT_RATE)})</span>
              <span className="tabular-nums">{formatRp(orderCharges.taxTotal)}</span>
            </div>
            <div className="flex justify-between px-4 py-3 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatRp(orderCharges.total)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Catatan <span className="text-muted-foreground font-normal">(opsional)</span></label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none text-sm"
              rows={3}
            />
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20">
          <div className="mx-auto w-full max-w-md border-t bg-background px-5 py-3">
            <Button
              className="h-12 w-full text-base"
              onClick={confirm}
              disabled={submitting || totalQty === 0}
            >
              {submitting ? "Mengirim pesanan..." : "Konfirmasi Pesanan"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── MENU SCREEN ─────────────────────────────────────────────────
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b bg-background px-5 py-4">
        <h1 className="text-2xl font-semibold tracking-tight">Menu</h1>
        {table && <p className="text-sm text-muted-foreground">{table.name}</p>}
        {!table && name && <p className="text-sm text-muted-foreground">Hai, {name}</p>}
      </header>

      <div className="flex-1 px-5 py-4 pb-28 space-y-7">
        {categories.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-10">
            Belum ada produk yang tersedia.
          </p>
        )}
        {categories.map((cat) => (
          <section key={cat.name} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {cat.name}
            </h2>
            <div className="divide-y rounded-lg border">
              {cat.items.map((item) => {
                const qty = cart[item.id] ?? 0;
                return (
                  <div key={item.id} className="flex items-center gap-3 px-3 py-3">
                    <div className="size-12 rounded-md bg-muted overflow-hidden shrink-0">
                      {item.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt={item.name} className="size-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{item.name}</div>
                      <div className="text-sm text-muted-foreground tabular-nums">
                        {item.price > 0 ? formatRp(item.price) : "—"}
                      </div>
                    </div>
                    {qty === 0 ? (
                      <Button size="sm" variant="outline" onClick={() => setQty(item.id, 1)} className="h-9">
                        <Plus className="size-4" /> Tambah
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button size="icon" variant="outline" className="size-9" onClick={() => setQty(item.id, -1)}>
                          <Minus className="size-4" />
                        </Button>
                        <span className="w-6 text-center text-sm font-medium tabular-nums">{qty}</span>
                        <Button size="icon" variant="outline" className="size-9" onClick={() => setQty(item.id, 1)}>
                          <Plus className="size-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {totalQty > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20">
          <div className="mx-auto w-full max-w-md border-t bg-background px-5 py-3">
            <Button
              className="h-12 w-full justify-between text-base"
              onClick={() => setView("review")}
            >
              <span className="flex items-center gap-2">
                <ShoppingBag className="size-5" />
                {totalQty} item · Review Pesanan
              </span>
              <span className="tabular-nums">{formatRp(orderCharges.total)}</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
