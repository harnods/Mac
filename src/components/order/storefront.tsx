"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus, ShoppingBag, X, Search, Store } from "lucide-react";
import { useCart, formatRp } from "@/components/order/cart";
import type { MenuCategory, MenuItem } from "@/app/actions/online-order";

export function Storefront({ categories }: { categories: MenuCategory[] }) {
  const { count, subtotal } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [q, setQ] = useState("");

  const query = q.trim().toLowerCase();
  const filtered = query
    ? categories
        .map((c) => ({ ...c, items: c.items.filter((i) => i.name.toLowerCase().includes(query) || (i.description ?? "").toLowerCase().includes(query)) }))
        .filter((c) => c.items.length > 0)
    : categories;

  return (
    <div className="pb-28">
      {/* Hero */}
      <header className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 px-5 pb-6 pt-8 text-white">
        <div className="absolute -right-8 -top-8 size-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-sm font-medium text-white/90">
            <Store className="size-4" /> Machimoto · Take-away
          </div>
          <h1 className="mt-2 text-2xl font-bold leading-tight">Order ahead,<br />skip the queue.</h1>
          <p className="mt-1 text-sm text-white/85">Pay with QRIS / e-wallet and pick up in store.</p>
        </div>
      </header>

      {/* Search */}
      <div className="sticky top-0 z-20 border-b border-stone-200 bg-stone-50/95 px-4 py-3 backdrop-blur">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the menu…"
            className="h-11 w-full rounded-full border border-stone-200 bg-white pl-10 pr-4 text-sm outline-none placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
          />
        </div>
        {/* Category chips */}
        {!query && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((c) => (
              <a key={c.id} href={`#cat-${c.id}`} className="shrink-0 rounded-full border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-medium text-stone-600 active:scale-95">
                {c.name}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Menu */}
      <main className="px-4">
        {filtered.length === 0 && (
          <p className="py-16 text-center text-sm text-stone-500">No items match “{q}”.</p>
        )}
        {filtered.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-32 pt-6">
            <h2 className="mb-3 text-lg font-bold text-stone-800">{c.name}</h2>
            <div className="space-y-3">
              {c.items.map((it) => <ProductCard key={it.id} item={it} />)}
            </div>
          </section>
        ))}
        <p className="py-8 text-center text-xs text-stone-400">Prices in IDR · Take-away only</p>
      </main>

      {/* Sticky cart bar */}
      {count > 0 && !cartOpen && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md p-3">
          <button
            onClick={() => setCartOpen(true)}
            className="flex w-full items-center justify-between rounded-2xl bg-stone-900 px-5 py-3.5 text-white shadow-lg shadow-stone-900/25 active:scale-[0.99]"
          >
            <span className="flex items-center gap-2 font-medium">
              <span className="relative">
                <ShoppingBag className="size-5" />
                <span className="absolute -right-2 -top-2 grid size-4 place-items-center rounded-full bg-orange-500 text-[10px] font-bold">{count}</span>
              </span>
              View cart
            </span>
            <span className="font-semibold tabular-nums">{formatRp(subtotal)}</span>
          </button>
        </div>
      )}

      {cartOpen && <CartSheet onClose={() => setCartOpen(false)} />}
    </div>
  );
}

function ProductCard({ item }: { item: MenuItem }) {
  const { qtyOf, add, setQty } = useCart();
  const qty = qtyOf(item.id);
  return (
    <div className="flex gap-3 rounded-2xl border border-stone-200 bg-white p-3">
      <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-stone-100">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.name} className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="grid size-full place-items-center text-2xl">🍱</div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="font-semibold leading-snug text-stone-800">{item.name}</div>
        {item.description && <p className="mt-0.5 line-clamp-2 text-xs text-stone-500">{item.description}</p>}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-semibold tabular-nums text-stone-800">{formatRp(item.price)}</span>
          {qty === 0 ? (
            <button onClick={() => add(item)} className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-3.5 py-1.5 text-sm font-semibold text-white active:scale-95">
              <Plus className="size-4" /> Add
            </button>
          ) : (
            <div className="flex items-center gap-3 rounded-full bg-stone-100 px-1.5 py-1">
              <button onClick={() => setQty(item.id, qty - 1)} className="grid size-7 place-items-center rounded-full bg-white text-stone-700 shadow-sm active:scale-90"><Minus className="size-4" /></button>
              <span className="w-4 text-center text-sm font-bold tabular-nums">{qty}</span>
              <button onClick={() => setQty(item.id, qty + 1)} className="grid size-7 place-items-center rounded-full bg-orange-500 text-white shadow-sm active:scale-90"><Plus className="size-4" /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CartSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { lines, subtotal, setQty, count } = useCart();

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative mx-auto max-h-[85dvh] w-full max-w-md overflow-hidden rounded-t-3xl bg-white">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <h3 className="text-lg font-bold">Your order</h3>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-full bg-stone-100 text-stone-600"><X className="size-4" /></button>
        </div>
        <div className="max-h-[45dvh] overflow-y-auto px-5 py-3">
          {lines.length === 0 ? (
            <p className="py-10 text-center text-sm text-stone-500">Your cart is empty.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {lines.map((l) => (
                <li key={l.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-stone-800">{l.name}</div>
                    <div className="text-xs text-stone-500 tabular-nums">{formatRp(l.price)}</div>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-full bg-stone-100 px-1.5 py-1">
                    <button onClick={() => setQty(l.id, l.qty - 1)} className="grid size-7 place-items-center rounded-full bg-white text-stone-700 shadow-sm active:scale-90"><Minus className="size-4" /></button>
                    <span className="w-4 text-center text-sm font-bold tabular-nums">{l.qty}</span>
                    <button onClick={() => setQty(l.id, l.qty + 1)} className="grid size-7 place-items-center rounded-full bg-orange-500 text-white shadow-sm active:scale-90"><Plus className="size-4" /></button>
                  </div>
                  <div className="w-20 text-right text-sm font-semibold tabular-nums text-stone-800">{formatRp(l.price * l.qty)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-stone-100 px-5 pb-6 pt-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-stone-500">Subtotal</span>
            <span className="text-lg font-bold tabular-nums">{formatRp(subtotal)}</span>
          </div>
          <button
            disabled={count === 0}
            onClick={() => { onClose(); router.push("/order/checkout"); }}
            className="w-full rounded-2xl bg-stone-900 py-3.5 font-semibold text-white disabled:opacity-40 active:scale-[0.99]"
          >
            Checkout
          </button>
        </div>
      </div>
    </div>
  );
}
