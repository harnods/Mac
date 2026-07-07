"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { closeOrderShift, openOrderShift } from "@/app/actions/orders";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/format";
import type { OrderShiftSummary } from "./order-shift-indicator";

function personName(person: { full_name: string | null; email: string } | null) {
  if (!person) return "Unknown";
  return person.full_name || person.email.split("@")[0];
}

export function OrderShiftSidebar() {
  const router = useRouter();
  const supabase = useRef(createClient());
  const [pending, startTransition] = useTransition();
  const [shift, setShift] = useState<OrderShiftSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const isOpen = !!shift && !shift.closed_at;

  const loadShift = useCallback(async () => {
    const { data } = await supabase.current
      .from("order_shifts")
      .select(
        "id, opened_at, closed_at, opened_by:profiles!order_shifts_opened_by_fkey(full_name,email), closed_by:profiles!order_shifts_closed_by_fkey(full_name,email)",
      )
      .order("closed_at", { ascending: false, nullsFirst: true })
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setShift((data ?? null) as OrderShiftSummary | null);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadShift();
    const client = supabase.current;
    const channel = client
      .channel("order-shift-sidebar")
      .on("postgres_changes", { event: "*", schema: "public", table: "order_shifts" }, () => {
        loadShift();
      })
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [loadShift]);

  function run(action: "open" | "close") {
    startTransition(async () => {
      const res = action === "open" ? await openOrderShift() : await closeOrderShift();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(action === "open" ? "Shift opened" : "Shift closed");
      await loadShift();
      router.refresh();
    });
  }

  return (
    <div className="mx-2 mb-3 rounded-[8px] border border-[#e1e7f2] bg-white/55 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-[#0a0a0a]">Shift</div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-[#0a0a0a]">
          <span className={isOpen ? "size-2 rounded-full bg-emerald-500" : "size-2 rounded-full bg-slate-300"} />
          {loading ? "Loading" : isOpen ? "Open" : "Closed"}
        </div>
      </div>

      <div className="mt-2 min-h-10 text-xs leading-5 text-muted-foreground">
        {loading ? (
          "Checking shift..."
        ) : isOpen && shift ? (
          <>
            Opened by {personName(shift.opened_by)}
            <br />
            {formatDateTime(shift.opened_at)}
          </>
        ) : shift?.closed_at ? (
          <>
            Closed by {personName(shift.closed_by)}
            <br />
            {formatDateTime(shift.closed_at)}
          </>
        ) : (
          "No shift has been opened yet"
        )}
      </div>

      {isOpen ? (
        <Button
          size="sm"
          variant="outline"
          className="mt-3 h-8 w-full text-xs"
          onClick={() => run("close")}
          disabled={pending || loading}
        >
          {pending ? "Closing..." : "Close shift"}
        </Button>
      ) : (
        <Button
          size="sm"
          className="mt-3 h-8 w-full text-xs"
          onClick={() => run("open")}
          disabled={pending || loading}
        >
          {pending ? "Opening..." : "Open shift"}
        </Button>
      )}
    </div>
  );
}
