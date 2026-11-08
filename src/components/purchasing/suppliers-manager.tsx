"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, MoreHorizontal, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, STICKY_ACTION_HEAD, STICKY_ACTION_CELL,
} from "@/components/ui/table";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { SupplierFormDialog, SupplierDeleteDialog } from "@/components/purchasing/supplier-dialogs";
import { waLink } from "@/lib/whatsapp";
import type { SupplierWithPics } from "@/lib/supabase/types";

export type SupplierListRow = SupplierWithPics & { ingredientCount: number };

export function SuppliersManager({ suppliers, canEdit }: { suppliers: SupplierListRow[]; canEdit: boolean }) {
  const [q, setQ] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierWithPics | null>(null);
  const [del, setDel] = useState<SupplierWithPics | null>(null);

  const filtered = suppliers.filter((s) => s.name.toLowerCase().includes(q.trim().toLowerCase()));

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(s: SupplierWithPics) {
    setEditing(s);
    setFormOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Suppliers</h1>
        {canEdit && (
          <Button onClick={openAdd}>
            <Plus className="size-4" /> Add supplier
          </Button>
        )}
      </div>

      <div className="flex justify-end">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search suppliers"
          className="max-w-xs"
        />
      </div>

      {suppliers.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">Belum ada supplier.</div>
      ) : filtered.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">No suppliers match your search.</div>
      ) : (
        <div className="border table-outer rounded-lg overflow-x-auto">
          <Table className="w-auto min-w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[260px]">Supplier</TableHead>
                <TableHead className="w-[320px]">PIC &amp; WhatsApp</TableHead>
                <TableHead className="w-28">Ingredients</TableHead>
                <TableHead className="w-0 p-0" />
                <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <ClickableTableRow key={s.id} href={`/purchasing/suppliers/${s.id}`}>
                  <TableCell className="font-medium align-top">
                    <Link href={`/purchasing/suppliers/${s.id}`} className="hover:underline">{s.name}</Link>
                  </TableCell>
                  <TableCell className="align-top">
                    {s.supplier_pics.length === 0 ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : (
                      <ul className="space-y-1">
                        {s.supplier_pics.map((p) => (
                          <li key={p.id} className="flex flex-wrap items-center gap-x-2 text-sm">
                            <span>{p.name}</span>
                            {p.whatsapp && (
                              <a
                                href={waLink(p.whatsapp)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline tabular-nums"
                              >
                                <MessageCircle className="size-3" /> {p.whatsapp}
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                  <TableCell className="align-top tabular-nums">{s.ingredientCount}</TableCell>
                  <TableCell />
                  <TableCell className={STICKY_ACTION_CELL}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/purchasing/suppliers/${s.id}`}>View details</Link>
                        </DropdownMenuItem>
                        {canEdit && (
                          <>
                            <DropdownMenuItem onSelect={() => openEdit(s)}>Edit</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => setDel(s)}>Delete</DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </ClickableTableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <SupplierFormDialog open={formOpen} onOpenChange={setFormOpen} supplier={editing} />
      <SupplierDeleteDialog supplier={del} open={!!del} onOpenChange={(o) => !o && setDel(null)} />
    </div>
  );
}
