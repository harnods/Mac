"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Check, Clock, ChefHat, PackageCheck, PartyPopper } from "lucide-react";
import { formatRp } from "@/components/order/cart";
import { simulatePayment, getOrderStatus, type OnlineOrder, type OnlineOrderItem } from "@/app/actions/online-order";
import type { Charge } from "@/lib/payments";

const STEPS: { key: OnlineOrder["status"]; label: string; icon: typeof Clock }[] = [
  { key: "paid", label: "Order placed", icon: Check },
  { key: "preparing", label: "Preparing", icon: ChefHat },
  { key: "ready", label: "Ready for pickup", icon: PackageCheck },
  { key: "picked_up", label: "Picked up", icon: PartyPopper },
];
const ORDER: OnlineOrder["status"][] = ["paid", "preparing", "ready", "picked_up"];

export function OrderView({ order, items, charge, token }: { order: OnlineOrder; items: OnlineOrderItem[]; charge: Charge | null; token: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const unpaid = order.payment_status === "unpaid" && order.status === "pending_payment";

  // Poll for changes (mock payment / staff advancing status) and refresh.
  useEffect(() => {
    const iv = setInterval(async () => {
      const s = await getOrderStatus(token);
      if (s && (s.status !== order.status || s.payment_status !== order.payment_status)) router.refresh();
    }, 4000);
    return () => clearInterval(iv);
  }, [token, order.status, order.payment_status, router]);

  if (unpaid && charge) {
    return (
      <div className="min-h-dvh px-5 py-6">
        <div className="text-center">
          <div className="text-sm font-medium text-stone-500">Order {order.order_number}</div>
          <h1 className="mt-1 text-xl font-bold">{charge.kind === "redirect" ? "Complete your payment" : "Scan to pay"}</h1>
          <p className="mt-1 text-sm text-stone-500">QRIS · GoPay · OVO · ShopeePay · DANA</p>
        </div>

        {charge.kind === "redirect" ? (
          <div className="mx-auto mt-6 w-full max-w-xs">
            <div className="rounded-3xl border border-stone-200 bg-white p-6 text-center shadow-sm">
              <div className="text-xs text-stone-500">Total to pay</div>
              <div className="mt-1 text-3xl font-bold tabular-nums">{formatRp(order.total)}</div>
            </div>
            <a
              href={charge.paymentUrl}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-900 py-4 text-base font-semibold text-white active:scale-[0.99]"
            >
              Pay now
            </a>
            <p className="mt-3 text-center text-xs text-stone-400">
              You&rsquo;ll choose QRIS or your e-wallet on the secure DOKU page, then return here. This page updates automatically once paid.
            </p>
          </div>
        ) : (
          <>
            <div className="mx-auto mt-5 w-full max-w-xs rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={charge.qrDataUrl} alt="QRIS" className="mx-auto aspect-square w-full rounded-xl" />
              <div className="mt-4 text-center">
                <div className="text-xs text-stone-500">Total</div>
                <div className="text-2xl font-bold tabular-nums">{formatRp(order.total)}</div>
              </div>
            </div>
            {charge.mock && (
              <button
                disabled={pending}
                onClick={() => start(async () => { const r = await simulatePayment(token); if (r.ok) router.refresh(); })}
                className="mx-auto mt-5 flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-stone-900 py-3.5 font-semibold text-white disabled:opacity-50 active:scale-[0.99]"
              >
                {pending ? <><Loader2 className="size-4 animate-spin" /> Confirming…</> : "Simulate payment (demo)"}
              </button>
            )}
            <p className="mx-auto mt-3 max-w-xs text-center text-xs text-stone-400">
              Keep this page open — it updates automatically once payment is received.
            </p>
          </>
        )}
      </div>
    );
  }

  // Paid → status tracker
  const currentIdx = Math.max(0, ORDER.indexOf(order.status === "cancelled" ? "paid" : order.status));
  return (
    <div className="min-h-dvh px-5 py-6">
      {/* Pickup code card */}
      <div className="rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-6 text-center text-white shadow-lg shadow-orange-500/20">
        <div className="text-sm font-medium text-white/85">Show this at pickup</div>
        <div className="mt-1 font-mono text-5xl font-bold tracking-[0.2em]">{order.pickup_code}</div>
        <div className="mt-2 text-sm text-white/85">Order {order.order_number}</div>
      </div>

      {order.status === "ready" && (
        <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-700">
          🎉 Your order is ready! Come pick it up.
        </div>
      )}

      {/* Tracker */}
      <div className="mt-6 space-y-1">
        {STEPS.map((s, i) => {
          const done = i <= currentIdx;
          const active = i === currentIdx;
          const Icon = s.icon;
          return (
            <div key={s.key} className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <div className={`grid size-9 place-items-center rounded-full ${done ? "bg-orange-500 text-white" : "bg-stone-200 text-stone-400"}`}>
                  <Icon className="size-4" />
                </div>
                {i < STEPS.length - 1 && <div className={`h-6 w-0.5 ${i < currentIdx ? "bg-orange-500" : "bg-stone-200"}`} />}
              </div>
              <span className={`text-sm ${active ? "font-bold text-stone-900" : done ? "font-medium text-stone-700" : "text-stone-400"}`}>{s.label}</span>
            </div>
          );
        })}
      </div>

      {/* Order details */}
      <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-4">
        <div className="mb-2 text-sm font-semibold text-stone-800">Order details</div>
        <ul className="divide-y divide-stone-100">
          {items.map((l) => (
            <li key={l.id} className="flex justify-between gap-3 py-2 text-sm">
              <span className="text-stone-700"><span className="font-medium tabular-nums">{l.qty}×</span> {l.name_snapshot}</span>
              <span className="tabular-nums text-stone-600">{formatRp(l.line_total)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-stone-100 pt-3">
          <span className="text-sm text-stone-500">Total paid</span>
          <span className="font-bold tabular-nums">{formatRp(order.total)}</span>
        </div>
        <div className="mt-3 text-xs text-stone-400">Under {order.customer_name} · {order.customer_phone}</div>
      </div>

      <Link href="/order" className="mt-5 block rounded-2xl bg-stone-100 py-3 text-center font-semibold text-stone-700 active:scale-[0.99]">Order again</Link>
    </div>
  );
}
