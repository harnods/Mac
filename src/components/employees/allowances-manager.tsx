"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { PayrollComponentDrawer, type ComponentPrefill } from "@/components/employees/payroll-component-drawer";
import { deleteAllowance } from "@/app/actions/employees";
import { activeVersion, FORMULA_BASIS_LABEL } from "@/lib/payroll-component";
import { formatDate } from "@/lib/format";
import type { Allowance, PayrollComponentVersion } from "@/lib/supabase/types";

export type ComponentRow = { component: Allowance; versions: PayrollComponentVersion[] };

export function AllowancesManager({ items, isAdmin, today }: { items: ComponentRow[]; isAdmin: boolean; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ComponentPrefill | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Allowance | null>(null);

  const shown = items.filter((r) => r.component.name.toLowerCase().includes(search.trim().toLowerCase()));

  function openEdit(row: ComponentRow) {
    const v = activeVersion(row.versions, today);
    setEditing({
      id: row.component.id,
      name: row.component.name,
      type: row.component.type,
      effective_date: v?.effective_date ?? today,
      formula_basis: v?.formula_basis ?? null,
      formula_rate: v?.formula_rate ?? null,
    });
    setDrawerOpen(true);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    start(async () => {
      const res = await deleteAllowance(deleteTarget.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Payroll component deleted");
      setDeleteTarget(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex justify-end">
        <Input placeholder="Search components..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-56" />
      </div>

      <div className="border table-outer rounded-lg overflow-x-auto mt-4">
        <Table className="w-auto min-w-full table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[240px]">Name</TableHead>
              <TableHead className="w-[130px]">Type</TableHead>
              <TableHead className="w-[160px]">Formula</TableHead>
              <TableHead className="w-[200px]">Effective date</TableHead>
              <TableHead className="p-0" />
              {isAdmin && <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-sm text-muted-foreground py-8">
                  No payroll components found.
                </TableCell>
              </TableRow>
            )}
            {shown.map((row) => {
              const v = activeVersion(row.versions, today);
              return (
                <ClickableTableRow key={row.component.id} href={`/hr/allowances/${row.component.id}`}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-2">
                      <Link href={`/hr/allowances/${row.component.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                        {row.component.name}
                      </Link>
                      {row.component.is_default && <Badge variant="secondary">Default</Badge>}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{row.component.type === "earning" ? "Earning" : "Deduction"}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {v?.formula_basis ? (
                      <Badge variant="secondary">{FORMULA_BASIS_LABEL[v.formula_basis]}</Badge>
                    ) : (
                      <span className="text-muted-foreground">Fixed amount</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {v ? formatDate(v.effective_date) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="p-0" />
                  {isAdmin && (
                    <TableCell className={STICKY_ACTION_CELL}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8" onClick={(e) => e.stopPropagation()}>
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => openEdit(row)}>Edit</DropdownMenuItem>
                          {!row.component.is_default && (
                            <DropdownMenuItem onSelect={() => setDeleteTarget(row.component)}>Delete</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </ClickableTableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <PayrollComponentDrawer open={drawerOpen} onOpenChange={setDrawerOpen} prefill={editing} today={today} />

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</DialogTitle>
            <DialogDescription>This removes the component and its history. This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
            <Button disabled={pending} onClick={handleDelete}>{pending ? "Deleting..." : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
