"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Minus, Plus, Search, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { formatRp } from "@/lib/format";
import { calculateOrderCharges, formatRate, PBJT_RATE, SERVICE_CHARGE_RATE } from "@/lib/order-charges";
import { createCustomerOrder } from "@/app/actions/orders";
import { toast } from "sonner";

export type MenuItem = { id: string; name: string; unit: string; price: number; imageUrl: string | null; description: string | null };
export type MenuAddon = { id: string; name: string; price: number };
export type MenuCategory = { name: string; items: MenuItem[] };
export type TableInfo = { id: string; name: string; code: string };

export function MenuClient({
  categories,
  addons = [],
  table,
}: {
  categories: MenuCategory[];
  addons?: MenuAddon[];
  table?: TableInfo;
}) {
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
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [view, setView] = useState<"menu" | "review">("menu");
  const [submitting, startSubmit] = useTransition();

  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState(categories[0]?.name ?? "");
  const [sheetItem, setSheetItem] = useState<MenuItem | null>(null);
  // Time-based greeting, computed after mount to avoid an SSR/client mismatch.
  const [greeting, setGreeting] = useState("Welcome");
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
  }, []);

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (!table && !phone) router.replace("/order");
  }, [phone, router, table]);

  // Lookup of everything orderable (products + add-ons) for cart math + review.
  const allItems = useMemo(() => {
    const map: Record<string, { name: string; price: number; imageUrl: string | null }> = {};
    for (const c of categories) for (const i of c.items) map[i.id] = { name: i.name, price: i.price, imageUrl: i.imageUrl };
    for (const a of addons) map[a.id] = { name: a.name, price: a.price, imageUrl: null };
    return map;
  }, [categories, addons]);

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

  const q = query.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!q) return null;
    return categories.flatMap((c) => c.items).filter((i) => i.name.toLowerCase().includes(q));
  }, [q, categories]);

  function scrollToCat(catName: string) {
    setActiveCat(catName);
    sectionRefs.current[catName]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function confirm() {
    if (totalQty === 0) return;
    if (!table && !phone) return;
    startSubmit(async () => {
      const res = await createCustomerOrder({
        phone: phone ?? undefined,
        name: name || undefined,
        tableId: table?.id,
        notes: notes.trim() || undefined,
        items: lines.map(([item_id, qty]) => ({ item_id, qty, note: itemNotes[item_id] || undefined })),
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
        <header className="sticky top-0 z-10 border-b bg-background/95 px-5 py-4 flex items-center gap-3 backdrop-blur">
          <button onClick={() => setView("menu")} className="p-1 -ml-1 rounded-md hover:bg-accent">
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Review order</h1>
            {table && <p className="text-sm text-muted-foreground">{table.name}</p>}
          </div>
        </header>

        <div className="flex-1 px-5 py-5 space-y-5 pb-32">
          <div className="divide-y rounded-xl border">
            {lines.map(([id, qty]) => {
              const item = allItems[id];
              if (!item) return null;
              return (
                <div key={id} className="flex items-center gap-3 px-4 py-3">
                  <div className="size-11 rounded-lg bg-muted overflow-hidden shrink-0">
                    {item.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.name} className="size-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.name}</div>
                    {item.price > 0 && (
                      <div className="text-sm text-muted-foreground tabular-nums">{formatRp(item.price)}</div>
                    )}
                    {itemNotes[id] && (
                      <div className="mt-0.5 text-xs text-muted-foreground truncate">Note: {itemNotes[id]}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="icon" variant="outline" className="size-8 rounded-full" onClick={() => setQty(id, -1)}>
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-5 text-center text-sm font-medium tabular-nums">{qty}</span>
                    <Button size="icon" variant="outline" className="size-8 rounded-full" onClick={() => setQty(id, 1)}>
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                  <div className="text-sm font-medium tabular-nums w-20 text-right shrink-0">
                    {item.price > 0 ? formatRp(item.price * qty) : "—"}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border divide-y">
            <Row label="Subtotal" value={formatRp(orderCharges.subtotal)} />
            <Row label={`Service charge (${formatRate(SERVICE_CHARGE_RATE)})`} value={formatRp(orderCharges.serviceCharge)} />
            <Row label={`PBJT (${formatRate(PBJT_RATE)})`} value={formatRp(orderCharges.taxTotal)} />
            <div className="flex justify-between px-4 py-3 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatRp(orderCharges.total)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Note <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="resize-none text-sm" rows={3} placeholder="Contoh: kurangi es, pedas sedang…" />
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20">
          <div className="mx-auto w-full max-w-md border-t bg-background px-5 py-3">
            <Button className="h-12 w-full text-base" onClick={confirm} disabled={submitting || totalQty === 0}>
              {submitting ? "Sending order…" : `Confirm · ${formatRp(orderCharges.total)}`}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── MENU SCREEN ─────────────────────────────────────────────────
  return (
    <div className="flex flex-1 flex-col">
      {/* Brand + greeting (scrolls away) */}
      <div className="px-5 pt-5 pb-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/machimoto-logotype.svg" alt="Machimoto" className="h-6 w-auto" />
        <div className="mt-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting}{name ? `, ${name}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            {table ? table.name : "What would you like to order?"}
          </p>
        </div>
      </div>

      {/* Sticky search + category tabs */}
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search menu…"
              className="h-11 pl-9"
            />
          </div>
        </div>
        {!q && categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-5 pb-3 no-scrollbar">
            {categories.map((c) => (
              <button
                key={c.name}
                onClick={() => scrollToCat(c.name)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                  activeCat === c.name ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="flex-1 px-5 py-4 pb-28 space-y-7">
        {categories.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">No menu available yet.</p>
        )}

        {/* Search results */}
        {q ? (
          searchResults && searchResults.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {searchResults.map((item) => (
                <MenuCard key={item.id} item={item} qty={cart[item.id] ?? 0} onAdd={() => setQty(item.id, 1)} onOpen={() => setSheetItem(item)} />
              ))}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">No items match “{query}”.</p>
          )
        ) : (
          categories.map((cat) => (
            <section
              key={cat.name}
              ref={(el) => { sectionRefs.current[cat.name] = el; }}
              className="scroll-mt-40 space-y-3"
            >
              <h2 className="text-sm font-semibold">{cat.name}</h2>
              <div className="grid grid-cols-2 gap-3">
                {cat.items.map((item) => (
                  <MenuCard key={item.id} item={item} qty={cart[item.id] ?? 0} onAdd={() => setQty(item.id, 1)} onOpen={() => setSheetItem(item)} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {/* Cart bar */}
      {totalQty > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20">
          <div className="mx-auto w-full max-w-md border-t bg-background px-5 py-3">
            <Button className="h-12 w-full justify-between text-base" onClick={() => setView("review")}>
              <span className="flex items-center gap-2">
                <ShoppingBag className="size-5" />
                {totalQty} item{totalQty > 1 ? "s" : ""}
              </span>
              <span className="tabular-nums">{formatRp(orderCharges.total)}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Item detail sheet */}
      <ItemSheet
        item={sheetItem}
        addons={addons}
        onClose={() => setSheetItem(null)}
        onAdd={(itemQty, addonQty, note) => {
          if (!sheetItem) return;
          const id = sheetItem.id;
          setCart((prev) => {
            const copy = { ...prev };
            copy[id] = (copy[id] ?? 0) + itemQty;
            for (const [aid, aq] of Object.entries(addonQty)) {
              if (aq > 0) copy[aid] = (copy[aid] ?? 0) + aq;
            }
            return copy;
          });
          setItemNotes((prev) => {
            const copy = { ...prev };
            if (note) copy[id] = note;
            else delete copy[id];
            return copy;
          });
          setSheetItem(null);
        }}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-4 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function MenuCard({
  item,
  qty,
  onAdd,
  onOpen,
}: {
  item: MenuItem;
  qty: number;
  onAdd: () => void;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="group flex flex-col overflow-hidden rounded-xl border text-left transition-shadow hover:shadow-sm"
    >
      <div className="relative aspect-square w-full bg-muted">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.name} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <UtensilsCrossed className="size-8" />
          </div>
        )}
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onAdd(); } }}
          className="absolute bottom-2 right-2 flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-95"
        >
          <Plus className="size-4" />
          {qty > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[11px] font-semibold text-background">
              {qty}
            </span>
          )}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-2.5">
        <div className="line-clamp-2 text-sm font-medium leading-snug">{item.name}</div>
        <div className="mt-auto text-sm font-semibold tabular-nums">{item.price > 0 ? formatRp(item.price) : "—"}</div>
      </div>
    </button>
  );
}

function ItemSheet({
  item,
  addons,
  onClose,
  onAdd,
}: {
  item: MenuItem | null;
  addons: MenuAddon[];
  onClose: () => void;
  onAdd: (itemQty: number, addonQty: Record<string, number>, note: string) => void;
}) {
  const [qty, setQty] = useState(1);
  const [addonQty, setAddonQty] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");

  // Reset local state whenever a new item opens.
  useEffect(() => {
    setQty(1);
    setAddonQty({});
    setNote("");
  }, [item?.id]);

  const addonTotal = addons.reduce((s, a) => s + a.price * (addonQty[a.id] ?? 0), 0);
  const lineTotal = (item?.price ?? 0) * qty + addonTotal;

  const bump = (id: string, delta: number) =>
    setAddonQty((prev) => {
      const next = Math.max(0, (prev[id] ?? 0) + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });

  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="p-0">
        {item && (
          <>
            <div className="relative aspect-square w-full bg-muted">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt={item.name} className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground">
                  <UtensilsCrossed className="size-10" />
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <h2 className="text-lg font-semibold tracking-tight">{item.name}</h2>
              {item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}
              <p className="mt-2 text-base font-semibold tabular-nums">{item.price > 0 ? formatRp(item.price) : "—"}</p>

              {addons.length > 0 && (
                <div className="mt-5">
                  <p className="text-sm font-semibold">Add-ons</p>
                  <div className="mt-2 divide-y rounded-xl border">
                    {addons.map((a) => (
                      <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">{a.name}</div>
                          <div className="text-xs text-muted-foreground tabular-nums">+{formatRp(a.price)}</div>
                        </div>
                        {(addonQty[a.id] ?? 0) === 0 ? (
                          <Button size="sm" variant="outline" className="h-8" onClick={() => bump(a.id, 1)}>
                            <Plus className="size-4" />
                          </Button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Button size="icon" variant="outline" className="size-8 rounded-full" onClick={() => bump(a.id, -1)}>
                              <Minus className="size-3.5" />
                            </Button>
                            <span className="w-5 text-center text-sm font-medium tabular-nums">{addonQty[a.id]}</span>
                            <Button size="icon" variant="outline" className="size-8 rounded-full" onClick={() => bump(a.id, 1)}>
                              <Plus className="size-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5 space-y-2">
                <p className="text-sm font-semibold">
                  Note <span className="font-normal text-muted-foreground">(optional)</span>
                </p>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={200}
                  placeholder="e.g. no onion, extra spicy — sent to the kitchen/bar"
                  className="resize-none text-sm"
                />
              </div>
            </div>

            <div className="border-t px-5 py-3 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Button size="icon" variant="outline" className="size-9 rounded-full" onClick={() => setQty((n) => Math.max(1, n - 1))}>
                  <Minus className="size-4" />
                </Button>
                <span className="w-6 text-center text-base font-medium tabular-nums">{qty}</span>
                <Button size="icon" variant="outline" className="size-9 rounded-full" onClick={() => setQty((n) => n + 1)}>
                  <Plus className="size-4" />
                </Button>
              </div>
              <Button className="h-11 flex-1 justify-between text-base" onClick={() => onAdd(qty, addonQty, note.trim())}>
                <span>Add</span>
                <span className="tabular-nums">{formatRp(lineTotal)}</span>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
