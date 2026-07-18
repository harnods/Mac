"use client";

import { useEffect, useRef, useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { claimOrderPoints, getLoyaltyTotal } from "@/app/actions/loyalty";

const SESSION_KEY = "loyalty_ig";

type State =
  | { type: "loading" }
  | { type: "input" }
  | { type: "claiming" }
  | { type: "done"; ig: string; billPoints: number; total: number }
  | { type: "skipped" };

function normaliseIg(raw: string) {
  return raw.replace(/^@/, "").toLowerCase().trim();
}

export function PointsClaim({
  orderId,
  points,
  alreadyClaimed,
  claimedByIg,
  pointsVoid,
}: {
  orderId: string;
  points: number;
  alreadyClaimed: boolean;
  claimedByIg: string | null;
  pointsVoid: boolean;
}) {
  const [state, setState] = useState<State>({ type: "loading" });
  const [igInput, setIgInput] = useState("");
  const [error, setError] = useState("");
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    if (pointsVoid) {
      setState({ type: "skipped" });
      return;
    }

    // Already claimed — show current balance
    if (alreadyClaimed && claimedByIg) {
      getLoyaltyTotal(claimedByIg).then((total) => {
        setState({ type: "done", ig: claimedByIg, billPoints: points, total });
      });
      return;
    }

    // Auto-claim if session has IG stored
    const storedIg = typeof window !== "undefined"
      ? sessionStorage.getItem(SESSION_KEY)
      : null;

    if (storedIg) {
      claimOrderPoints(orderId, storedIg).then((res) => {
        if (res.ok) {
          setState({ type: "done", ig: storedIg, billPoints: res.billPoints, total: res.totalPoints });
        } else {
          setState({ type: "input" });
        }
      });
    } else {
      setState({ type: "input" });
    }
  }, [orderId, alreadyClaimed, claimedByIg, points, pointsVoid]);

  async function handleClaim() {
    setError("");
    setState({ type: "claiming" });
    const ig = normaliseIg(igInput);
    const res = await claimOrderPoints(orderId, ig);
    if (!res.ok) {
      setError(res.error);
      setState({ type: "input" });
    } else {
      sessionStorage.setItem(SESSION_KEY, ig);
      setState({ type: "done", ig, billPoints: res.billPoints, total: res.totalPoints });
    }
  }

  if (state.type === "skipped") return null;

  if (state.type === "loading" || state.type === "claiming") {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-5 py-4 flex items-center gap-3">
        <Loader2 className="size-4 animate-spin text-amber-500 shrink-0" />
        <p className="text-sm">
          {state.type === "loading" ? "Mengecek points kamu..." : "Mengklaim points..."}
        </p>
      </div>
    );
  }

  if (state.type === "done") {
    const billLabel = state.billPoints > points
      ? `+${state.billPoints} points dari tagihan ini`
      : `+${state.billPoints} points ditambahkan!`;
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-5 py-4 space-y-1">
        <div className="flex items-center gap-2">
          <Star className="size-5 fill-amber-400 text-amber-400 shrink-0" />
          <p className="text-sm font-semibold">{billLabel}</p>
        </div>
        <p className="text-sm text-muted-foreground pl-7">
          @{state.ig} · total{" "}
          <span className="font-bold text-foreground">{state.total} points</span>
        </p>
        {state.billPoints > points && (
          <p className="text-xs text-muted-foreground pl-7">
            Termasuk points dari semua pesanan di meja ini yang belum diklaim
          </p>
        )}
      </div>
    );
  }

  // input state
  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-5 py-4 space-y-3">
      <div className="flex items-center gap-2">
        <Star className="size-5 fill-amber-400 text-amber-400 shrink-0" />
        <p className="text-sm font-semibold">
          Pesanan ini mendapat{" "}
          <span className="text-amber-600 dark:text-amber-400">{points} points</span>!
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        Masukkan ID Instagram kamu untuk mengumpulkan points. Bisa diredeem di kasir.
      </p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">
            @
          </span>
          <Input
            className="pl-7 h-10"
            value={igInput}
            onChange={(e) => { setIgInput(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter" && igInput.trim()) handleClaim(); }}
          />
        </div>
        <Button onClick={handleClaim} disabled={!igInput.trim()} className="h-10 shrink-0">
          Klaim
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button
        type="button"
        onClick={() => setState({ type: "skipped" })}
        className="text-xs text-muted-foreground hover:underline underline-offset-2"
      >
        Lewati
      </button>
    </div>
  );
}
