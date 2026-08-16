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
import { LocationRowActions } from "@/components/inventory/location-row-actions";

export type LocationRow = { id: string; name: string; itemCount: number };

export function LocationsTable({ locations, isAdmin }: { locations: LocationRow[]; isAdmin: boolean }) {
  return (
    <div className="border table-outer rounded-lg overflow-x-auto">
      <Table className="w-auto min-w-full table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[280px]">Name</TableHead>
            <TableHead className="w-[120px]">Items</TableHead>
            <TableHead className="w-0 p-0" />
            <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {locations.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="font-medium">{l.name}</TableCell>
              <TableCell className="text-muted-foreground text-sm tabular-nums">{l.itemCount}</TableCell>
              <TableCell />
              <TableCell className={STICKY_ACTION_CELL}>
                {isAdmin && <LocationRowActions id={l.id} name={l.name} />}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
