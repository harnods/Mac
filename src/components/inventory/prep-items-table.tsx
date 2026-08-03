"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  STICKY_ACTION_HEAD,
  STICKY_ACTION_CELL,
} from "@/components/ui/table";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { getItemColumns } from "@/lib/item-columns";
import { ITEM_TYPE_CONFIG } from "@/lib/item-types";
import { formatNum } from "@/lib/units";
import { formatDate, updaterName } from "@/lib/format";
import type { Updater } from "@/lib/supabase/types";

type PrepItemRow = {
  id: string;
  name: string;
  unit: string;
  on_hand: number;
  reserved: number;
  updated_at: string;
  updater: Updater | null;
};

const COLUMN_FLAGS = {
  showCategory: ITEM_TYPE_CONFIG["prep-items"].hasCategories,
  stockMode: ITEM_TYPE_CONFIG["prep-items"].stockMode,
  showCost: ITEM_TYPE_CONFIG["prep-items"].showCost,
  showSellable: ITEM_TYPE_CONFIG["prep-items"].showSellable,
  showDefaultCost: ITEM_TYPE_CONFIG["prep-items"].showDefaultCost,
};

export function PrepItemsTable({ list }: { list: PrepItemRow[] }) {
  const columns = getItemColumns(COLUMN_FLAGS);
  const { isVisible } = useColumnVisibility("items-prep-items", columns);

  return (
    <div className="border table-outer rounded-lg overflow-x-auto">
      <Table className="w-full table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[240px]">Name</TableHead>
            {isVisible("available") && <TableHead className="min-w-[160px]">Available</TableHead>}
            {isVisible("lastUpdated") && <TableHead className="min-w-[160px]">Last updated</TableHead>}
            <TableHead className="w-0 p-0" />
            <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((item) => {
            const available = Number(item.on_hand) - Number(item.reserved);

            return (
              <ClickableTableRow key={item.id} href={`/inventory/prep-items/${item.id}`}>
                <TableCell className="font-medium">
                  <Link
                    href={`/inventory/prep-items/${item.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="hover:underline"
                  >
                    {item.name}
                  </Link>
                </TableCell>
                {isVisible("available") && (
                  <TableCell className="text-sm tabular-nums">
                    {formatNum(available)}{" "}
                    <span className="text-muted-foreground">{item.unit}</span>
                  </TableCell>
                )}
                {isVisible("lastUpdated") && (
                  <TableCell className="text-sm">
                    <div>{updaterName(item.updater)}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(item.updated_at)}</div>
                  </TableCell>
                )}
                <TableCell />
                <TableCell className={STICKY_ACTION_CELL} />
              </ClickableTableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
