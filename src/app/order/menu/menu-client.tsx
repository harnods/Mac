"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRp } from "@/lib/format";
import { createCustomerOrder } from "@/app/actions/orders";
import { toast } from "sonner";

export type MenuItem = { id: string; name: string; unit: string; price: number };
export type MenuCategory = { name: string; items: MenuItem[] };

export function MenuClient({ categories }: { categories: MenuCategory[] }) {
  const router = useRouter();
  const [phone, setPhone] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [submitting, startSubmit] = useTransition();

  useEffect(() => {
    const p = sessionStorage.getItem("order_phone");
    if (!p) {
      router.replace("/order");
      return;
    }
    setPhone(p);
    setName(sessionStorage.getItem("order_name") ?? "");
  }, [router]);

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
  const totalPrice = lines.reduce((s, [id, q]) => s + (allItems[id]?.price ?? 0) * q, 0);

  function submit() {
    if (!phone || totalQty === 0) return;
    startSubmit(async () => {
      const res = await createCustomerOrder({
        phone,
        name: name || undefined,
        items: lines.map(([item_id, qty]) => ({ item_id, qty })),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      sessionStorage.removeItem("order_phone");
      sessionStorage.removeItem("order_name");
      router.push(`/order/confirm/${res.id}`);
    });
  }

  if (!phone) return null;

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b bg-background px-5 py-4">
        <h1 className="text-2xl font-semibold tracking-tight">Menu</h1>
        {name && <p className="text-sm text-muted-foreground">Hai, {name}</p>}
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
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{item.name}</div>
                      <div className="text-sm text-muted-foreground tabular-nums">
                        {item.price > 0 ? formatRp(item.price) : "—"}
                      </div>
                    </div>
                    {qty === 0 ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setQty(item.id, 1)}
                        className="h-9"
                      >
                        <Plus className="size-4" /> Tambah
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          className="size-9"
                          onClick={() => setQty(item.id, -1)}
                        >
                          <Minus className="size-4" />
                        </Button>
                        <span className="w-6 text-center text-sm font-medium tabular-nums">
                          {qty}
                        </span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="size-9"
                          onClick={() => setQty(item.id, 1)}
                        >
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
              onClick={submit}
              disabled={submitting}
            >
              <span className="flex items-center gap-2">
                <ShoppingBag className="size-5" />
                {submitting ? "Mengirim..." : `Pesan ${totalQty} item`}
              </span>
              <span className="tabular-nums">{formatRp(totalPrice)}</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
