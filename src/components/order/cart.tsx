"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartLine = { id: string; name: string; price: number; imageUrl: string | null; qty: number };
type CartMap = Record<string, CartLine>;

type CartCtx = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  qtyOf: (id: string) => number;
  add: (item: Omit<CartLine, "qty">) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "machimoto_cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<CartMap>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setMap(JSON.parse(raw)); } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) try { localStorage.setItem(KEY, JSON.stringify(map)); } catch {}
  }, [map, ready]);

  const value = useMemo<CartCtx>(() => {
    const lines = Object.values(map).filter((l) => l.qty > 0).sort((a, b) => a.name.localeCompare(b.name));
    return {
      lines,
      count: lines.reduce((s, l) => s + l.qty, 0),
      subtotal: lines.reduce((s, l) => s + l.qty * l.price, 0),
      qtyOf: (id) => map[id]?.qty ?? 0,
      add: (item) => setMap((m) => ({ ...m, [item.id]: { ...item, qty: (m[item.id]?.qty ?? 0) + 1 } })),
      setQty: (id, qty) => setMap((m) => {
        const n = { ...m };
        if (qty <= 0) delete n[id];
        else if (n[id]) n[id] = { ...n[id], qty };
        return n;
      }),
      clear: () => setMap({}),
    };
  }, [map]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used within CartProvider");
  return c;
}

export function formatRp(n: number) {
  return `Rp${Math.round(n).toLocaleString("id-ID")}`;
}
