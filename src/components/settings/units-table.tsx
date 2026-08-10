"use client";

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
import { UnitRowActions } from "@/components/inventory/unit-row-actions";

const CONVERSION_LABEL: Record<string, string> = {
  g: "g ↔ kg",
  kg: "g ↔ kg",
  ml: "ml ↔ l",
  l: "ml ↔ l",
};

export type UnitRow = { code: string; is_system: boolean };

export function UnitsTable({ units, isAdmin }: { units: UnitRow[]; isAdmin: boolean }) {
  return (
    <div className="border table-outer rounded-lg overflow-x-auto">
      <Table className="w-auto min-w-full table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[240px]">Code</TableHead>
            <TableHead className="w-[160px]">Type</TableHead>
            <TableHead className="w-[160px]">Conversion</TableHead>
            <TableHead className="w-0 p-0" />
            <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {units.map((u) => (
            <TableRow key={u.code}>
              <TableCell className="font-medium">{u.code}</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {u.is_system ? "System" : "Custom"}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {CONVERSION_LABEL[u.code] ?? "—"}
              </TableCell>
              <TableCell />
              <TableCell className={STICKY_ACTION_CELL}>
                {isAdmin && !u.is_system && <UnitRowActions code={u.code} />}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
