"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Qty } from "@/components/ui/qty";
import { formatNum } from "@/lib/units";
import { DeletedItemBadge } from "@/components/ui/deleted-item-badge";

type RequestItem = {
  id: string;
  qty: number;
  unit: string;
  item: { id: string; name: string; unit: string; on_hand: number; reserved: number; deleted_at: string | null } | null;
};

export function PurchaseRequestItemsList({ items }: { items: RequestItem[] }) {
  const [q, setQ] = useState("");
  const filtered = items.filter((ri) => (ri.item?.name ?? "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Input
          placeholder="Search items..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full sm:w-56"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No matching items.</p>
      ) : (
        <div>
          <div className="grid grid-cols-[0.5fr_4fr_1.5fr] gap-x-6 py-2 border-b text-xs text-muted-foreground">
            <span />
            <span>Item</span>
            <span>Requested qty</span>
          </div>
          {filtered.map((ri, idx) => (
            <div key={ri.id} className="grid grid-cols-[0.5fr_4fr_1.5fr] gap-x-6 items-center py-2 border-b last:border-0">
              <span className="text-sm text-muted-foreground text-right">{idx + 1}.</span>
              <span className="font-medium text-sm flex items-center">
                {ri.item?.name ?? "—"}
                {ri.item?.deleted_at && <DeletedItemBadge />}
              </span>
              <span className="tabular-nums text-sm">
                {ri.qty != null && ri.unit
                  ? <Qty value={ri.qty} unit={ri.unit} />
                  : ri.qty != null
                  ? formatNum(ri.qty)
                  : <span className="italic text-muted-foreground">qty not set</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
