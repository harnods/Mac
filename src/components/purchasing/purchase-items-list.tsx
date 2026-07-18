"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Qty } from "@/components/ui/qty";
import { formatNum } from "@/lib/units";
import { DeletedItemBadge } from "@/components/ui/deleted-item-badge";

type PurchaseItem = {
  id: string;
  qty_requested: number | null;
  requested_unit: string | null;
  qty_purchased: number;
  unit: string;
  cost_per_unit: number | null;
  cost_total: number | null;
  row_note: string | null;
  item: { id: string; name: string; unit: string; deleted_at: string | null } | null;
};

export function PurchaseItemsList({ items }: { items: PurchaseItem[] }) {
  const [q, setQ] = useState("");
  const filtered = items.filter((pi) => (pi.item?.name ?? "").toLowerCase().includes(q.toLowerCase()));

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
          <div className="grid grid-cols-[2rem_1fr_10rem_10rem_9rem] gap-x-6 py-2 border-b text-xs text-muted-foreground">
            <span />
            <span>Item</span>
            <span className="text-right">Requested</span>
            <span className="text-right">Purchased</span>
            <span className="text-right">Cost</span>
          </div>
          {filtered.map((pi, idx) => {
            const perUnit = pi.cost_per_unit != null
              ? pi.cost_per_unit
              : pi.cost_total != null && pi.qty_purchased > 0
              ? pi.cost_total / pi.qty_purchased
              : null;
            const costDisplay = pi.cost_total != null
              ? `Rp${formatNum(pi.cost_total)} / ${formatNum(pi.qty_purchased)} ${pi.unit}`
              : pi.cost_per_unit != null
              ? `Rp${formatNum(pi.cost_per_unit)}/${pi.unit}`
              : null;
            return (
              <div key={pi.id} className="border-b last:border-0">
                <div className="grid grid-cols-[2rem_1fr_10rem_10rem_9rem] gap-x-6 items-center py-2">
                  <span className="text-sm text-muted-foreground text-right">{idx + 1}.</span>
                  <span className="font-medium text-sm flex items-center">
                    {pi.item?.name ?? "—"}
                    {pi.item?.deleted_at && <DeletedItemBadge />}
                  </span>
                  <span className="tabular-nums text-sm text-right">
                    {pi.qty_requested != null
                      ? <Qty value={pi.qty_requested} unit={pi.requested_unit ?? pi.unit} />
                      : "—"}
                  </span>
                  <span className="tabular-nums text-sm text-right">
                    <Qty value={pi.qty_purchased} unit={pi.unit} />
                  </span>
                  <div className="text-right">
                    <div className="tabular-nums text-sm">
                      {costDisplay ?? "—"}
                    </div>
                    {pi.cost_total != null && perUnit != null && (
                      <div className="tabular-nums text-xs text-muted-foreground">
                        Rp{formatNum(perUnit)}/{pi.unit}
                      </div>
                    )}
                  </div>
                </div>
                {pi.row_note && (
                  <div className="ml-14 pb-2 text-xs text-muted-foreground">Note: {pi.row_note}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
