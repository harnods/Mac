"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

/** A section whose body toggles open/closed. Collapsed by default. */
export function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-base font-semibold"
      >
        <ChevronRight className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
        {title}
      </button>
      {open && children}
    </section>
  );
}
