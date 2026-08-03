"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Tiny diagnostic overlay: measures client-side navigation duration
// (click on a link -> destination page committed). Bottom-right corner.
// Remove once perf work is done.
export function PerfBadge({ serverMs }: { serverMs?: number }) {
  const pathname = usePathname();
  const [nav, setNav] = useState<number | null>(null);

  useEffect(() => {
    const w = window as unknown as { __navStart?: number };
    if (w.__navStart != null) {
      setNav(performance.now() - w.__navStart);
      w.__navStart = undefined;
    }
  }, [pathname]);

  useEffect(() => {
    const w = window as unknown as { __navStart?: number };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (a && (a as HTMLAnchorElement).href) w.__navStart = performance.now();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const tone = (ms: number) =>
    ms < 300 ? "text-emerald-600" : ms < 800 ? "text-amber-600" : "text-red-600";

  return (
    <div className="fixed bottom-1 right-2 z-[60] select-none pointer-events-none font-mono text-[10px] leading-tight text-muted-foreground/70 text-right">
      {nav != null && (
        <div>
          nav <span className={tone(nav)}>{Math.round(nav)}ms</span>
        </div>
      )}
      {serverMs != null && (
        <div>
          server <span className={tone(serverMs)}>{serverMs}ms</span>
        </div>
      )}
    </div>
  );
}
