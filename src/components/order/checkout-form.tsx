"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useCart, formatRp } from "@/components/order/cart";
import { createOnlineOrder } from "@/app/actions/online-order";

export function CheckoutForm() {
  const router = useRouter();
  const { lines, subtotal, clear } = useCart();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Please enter your name.");
    if (!/^[0-9+][0-9\s-]{6,}$/.test(phone.trim())) return setError("Please enter a valid WhatsApp number.");
    if (lines.length === 0) return setError("Your cart is empty.");
    start(async () => {
      const res = await createOnlineOrder({
        name, phone, note,
        items: lines.map((l) => ({ itemId: l.id, qty: l.qty })),
      });
      if (!res.ok) { setError(res.error); return; }
      clear();
      router.push(`/order/o/${res.data!.token}`);
    });
  }

  return (
    <div className="min-h-dvh pb-8">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-stone-200 bg-stone-50/95 px-4 py-3 backdrop-blur">
        <Link href="/order" className="grid size-9 place-items-center rounded-full bg-white text-stone-700 shadow-sm"><ArrowLeft className="size-4" /></Link>
        <h1 className="text-lg font-bold">Checkout</h1>
      </header>

      {lines.length === 0 ? (
        <div className="px-5 py-20 text-center">
          <p className="text-stone-500">Your cart is empty.</p>
          <Link href="/order" className="mt-4 inline-block rounded-full bg-orange-500 px-5 py-2.5 font-semibold text-white">Browse menu</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="px-4 py-4">
          {/* Order summary */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="mb-2 text-sm font-semibold text-stone-800">Your order</div>
            <ul className="divide-y divide-stone-100">
              {lines.map((l) => (
                <li key={l.id} className="flex justify-between gap-3 py-2 text-sm">
                  <span className="text-stone-700"><span className="font-medium tabular-nums">{l.qty}×</span> {l.name}</span>
                  <span className="tabular-nums text-stone-600">{formatRp(l.price * l.qty)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-stone-100 pt-3">
              <span className="text-sm text-stone-500">Subtotal</span>
              <span className="text-lg font-bold tabular-nums">{formatRp(subtotal)}</span>
            </div>
          </div>

          {/* Details */}
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="h-12 w-full rounded-xl border border-stone-200 bg-white px-4 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200" placeholder="Your name" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">WhatsApp number</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className="h-12 w-full rounded-xl border border-stone-200 bg-white px-4 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200" placeholder="08xx xxxx xxxx" />
              <p className="mt-1 text-xs text-stone-400">We use this to identify your pickup.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Note <span className="text-stone-400">(optional)</span></label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200" placeholder="e.g. less spicy" />
            </div>
          </div>

          {error && <p className="mt-3 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-600">{error}</p>}

          <button type="submit" disabled={pending} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-900 py-4 text-base font-semibold text-white disabled:opacity-50 active:scale-[0.99]">
            {pending ? <><Loader2 className="size-4 animate-spin" /> Placing order…</> : <>Continue to payment · {formatRp(subtotal)}</>}
          </button>
          <p className="mt-2 text-center text-xs text-stone-400">You&rsquo;ll pay with QRIS / e-wallet on the next step.</p>
        </form>
      )}
    </div>
  );
}
