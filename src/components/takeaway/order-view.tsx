"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Check, Clock, ChefHat, PackageCheck, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatRp } from "@/lib/format";
import { simulatePayment, getOrderStatus, setOnlineOrderContact, type OnlineOrder, type OnlineOrderItem } from "@/app/actions/online-order";
import type { Charge } from "@/lib/payments";

const STEPS: { key: OnlineOrder["status"]; label: string; icon: typeof Clock }[] = [
  { key: "paid", label: "Order placed", icon: Check },
  { key: "preparing", label: "Preparing", icon: ChefHat },
  { key: "ready", label: "Ready for pickup", icon: PackageCheck },
  { key: "picked_up", label: "Picked up", icon: PartyPopper },
];
const ORDER: OnlineOrder["status"][] = ["paid", "preparing", "ready", "picked_up"];

export function TakeawayOrderView({ order, items, charge, token }: { order: OnlineOrder; items: OnlineOrderItem[]; charge: Charge | null; token: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const unpaid = order.payment_status === "unpaid" && order.status === "pending_payment";
  const needsContact = order.payment_status === "paid" && (!order.customer_name?.trim() || !order.customer_phone?.trim());

  useEffect(() => {
    const iv = setInterval(async () => {
      const s = await getOrderStatus(token);
      if (s && (s.status !== order.status || s.payment_status !== order.payment_status)) router.refresh();
    }, 4000);
    return () => clearInterval(iv);
  }, [token, order.status, order.payment_status, router]);

  // ── PAYMENT ──────────────────────────────────────────────────────
  if (unpaid && charge) {
    return (
      <div className="flex flex-1 flex-col px-5 py-6">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/machimoto-logotype.svg" alt="Machimoto" className="mx-auto h-6 w-auto" />
          <div className="mt-4 text-sm text-muted-foreground">Order {order.order_number}</div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{charge.kind === "redirect" ? "Complete your payment" : "Scan to pay"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">QRIS · GoPay · OVO · ShopeePay · DANA</p>
        </div>

        {charge.kind === "redirect" ? (
          <div className="mx-auto mt-6 w-full">
            <div className="rounded-xl border p-6 text-center">
              <div className="text-sm text-muted-foreground">Total to pay</div>
              <div className="mt-1 text-3xl font-semibold tabular-nums">{formatRp(order.total)}</div>
            </div>
            <Button asChild className="mt-5 h-12 w-full text-base"><a href={charge.paymentUrl}>Pay now</a></Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">You&rsquo;ll choose QRIS or your e-wallet on the secure DOKU page, then return here. This page updates automatically once paid.</p>
          </div>
        ) : (
          <div className="mx-auto mt-6 w-full max-w-xs">
            <div className="rounded-xl border bg-card p-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={charge.qrDataUrl} alt="QRIS" className="mx-auto aspect-square w-full rounded-lg" />
              <div className="mt-4 text-center">
                <div className="text-xs text-muted-foreground">Total</div>
                <div className="text-2xl font-semibold tabular-nums">{formatRp(order.total)}</div>
              </div>
            </div>
            {charge.mock && (
              <Button className="mt-5 h-12 w-full text-base" disabled={pending} onClick={() => start(async () => { const r = await simulatePayment(token); if (r.ok) router.refresh(); })}>
                {pending ? <><Loader2 className="size-4 animate-spin" /> Confirming…</> : "Simulate payment (demo)"}
              </Button>
            )}
            <p className="mt-3 text-center text-xs text-muted-foreground">Keep this page open — it updates automatically once payment is received.</p>
          </div>
        )}
      </div>
    );
  }

  // ── CONTACT (collected after payment) ────────────────────────────
  if (needsContact) {
    function submitContact() {
      const digits = phone.replace(/[^\d]/g, "");
      if (!name.trim()) { toast.error("Enter your name"); return; }
      if (digits.length < 8) { toast.error("Enter a valid WhatsApp number"); return; }
      start(async () => {
        const r = await setOnlineOrderContact(token, name, phone);
        if (!r.ok) { toast.error(r.error); return; }
        router.refresh();
      });
    }
    return (
      <div className="flex flex-1 flex-col px-5 py-6">
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400">
          ✓ Payment received — order {order.order_number}
        </div>
        <div className="mt-6">
          <h1 className="text-xl font-semibold tracking-tight">Almost done</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter your details so we can hand your order to the right person at pickup.</p>
        </div>
        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="c-name">Name</Label>
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} className="h-12 text-base" autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-phone">WhatsApp number</Label>
            <Input id="c-phone" type="tel" inputMode="numeric" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12 text-base" />
          </div>
          <Button className="h-12 w-full text-base" disabled={pending} onClick={submitContact}>
            {pending ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : "Show my pickup code"}
          </Button>
        </div>
      </div>
    );
  }

  // ── STATUS ───────────────────────────────────────────────────────
  const currentIdx = Math.max(0, ORDER.indexOf(order.status === "cancelled" ? "paid" : order.status));
  return (
    <div className="flex flex-1 flex-col px-5 py-6">
      <div className="rounded-2xl border bg-card p-6 text-center">
        <div className="text-sm text-muted-foreground">Show this at pickup</div>
        <div className="mt-1 font-mono text-5xl font-bold tracking-[0.2em]">{order.pickup_code}</div>
        <div className="mt-2 text-sm text-muted-foreground">Order {order.order_number}</div>
      </div>

      {order.status === "ready" && (
        <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400">
          🎉 Your order is ready! Come pick it up.
        </div>
      )}

      <div className="mt-6 space-y-1">
        {STEPS.map((s, i) => {
          const done = i <= currentIdx;
          const active = i === currentIdx;
          const Icon = s.icon;
          return (
            <div key={s.key} className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <div className={`grid size-9 place-items-center rounded-full ${done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  <Icon className="size-4" />
                </div>
                {i < STEPS.length - 1 && <div className={`h-6 w-0.5 ${i < currentIdx ? "bg-primary" : "bg-muted"}`} />}
              </div>
              <span className={`text-sm ${active ? "font-semibold" : done ? "font-medium" : "text-muted-foreground"}`}>{s.label}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-xl border divide-y">
        {items.map((l) => (
          <div key={l.id} className="flex justify-between gap-3 px-4 py-3 text-sm">
            <span><span className="font-medium tabular-nums">{l.qty}×</span> {l.name_snapshot}</span>
            <span className="tabular-nums text-muted-foreground">{formatRp(l.line_total)}</span>
          </div>
        ))}
        <div className="flex justify-between px-4 py-3 font-semibold">
          <span>Total paid</span>
          <span className="tabular-nums">{formatRp(order.total)}</span>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Under {order.customer_name} · {order.customer_phone}</p>

      <Button asChild variant="outline" className="mt-5 h-11"><Link href="/takeaway">Order again</Link></Button>
    </div>
  );
}
