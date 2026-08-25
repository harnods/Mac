"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/format";
import { deleteRosterPattern } from "@/app/actions/schedule";

export type PatternRow = { id: string; name: string | null; effective_date: string; updatedAt: string | null; updatedBy: string | null; active: boolean };
export type PatternLog = { id: string; action: string; createdAt: string; actor: string | null; changes: { label: string; from: string; to: string }[] };

const dash = <span className="text-muted-foreground">—</span>;

export function SchedulePatternsManager({
  patterns,
  logsByPattern,
  isAdmin,
}: {
  patterns: PatternRow[];
  logsByPattern: Record<string, PatternLog[]>;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [del, setDel] = useState<PatternRow | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setOpen((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  function handleDelete() {
    if (!del) return;
    start(async () => {
      const res = await deleteRosterPattern(del.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Schedule deleted");
      setDel(null);
      router.refresh();
    });
  }

  const colSpan = isAdmin ? 6 : 4;

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Schedule patterns</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Weekly team schedules. Each takes effect on its date and repeats until the next one.
          </p>
        </div>
        {isAdmin && (
          <Button asChild>
            <Link href="/hr/schedule/new"><Plus className="size-4" /> New shift schedule</Link>
          </Button>
        )}
      </div>

      <div className="border table-outer rounded-lg overflow-x-auto">
        <Table className="w-auto min-w-full table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead className="w-[160px]">Effective date</TableHead>
              <TableHead className="w-[240px]">Name</TableHead>
              <TableHead className="w-[240px]">Last updated</TableHead>
              {isAdmin && <TableHead className="p-0" />}
              {isAdmin && <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {patterns.length === 0 && (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center text-sm text-muted-foreground py-8">
                  No schedules yet.
                </TableCell>
              </TableRow>
            )}
            {patterns.map((p) => {
              const logs = logsByPattern[p.id] ?? [];
              const isOpen = open.has(p.id);
              return (
                <>
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => toggle(p.id)}>
                    <TableCell className="pl-3 text-muted-foreground">
                      <ChevronRight className={`size-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                    </TableCell>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        <Link href={`/hr/schedule-patterns/${p.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">{formatDate(p.effective_date)}</Link>
                        {p.active && <Badge variant="success">Active</Badge>}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{p.name ?? dash}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.updatedAt ? (
                        <>
                          <span className="tabular-nums">{formatDateTime(p.updatedAt)}</span>
                          {p.updatedBy && <span className="block text-xs">by {p.updatedBy}</span>}
                        </>
                      ) : dash}
                    </TableCell>
                    {isAdmin && <TableCell className="p-0" />}
                    {isAdmin && (
                      <TableCell className={STICKY_ACTION_CELL} onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-auto">
                            <DropdownMenuItem asChild>
                              <Link href={`/hr/schedule-patterns/${p.id}`}>Edit</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setDel(p)}>Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                  {isOpen && (
                    <TableRow className="bg-muted/20">
                      <TableCell />
                      <TableCell colSpan={colSpan - 1} className="py-3">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Change log</div>
                        {logs.length === 0 ? (
                          <p className="mt-2 text-sm text-muted-foreground">No changes recorded.</p>
                        ) : (
                          <ul className="mt-2 space-y-3">
                            {logs.map((l) => (
                              <li key={l.id} className="text-sm">
                                <div className="text-muted-foreground">
                                  <span className="text-foreground capitalize">{l.action}</span>
                                  {l.actor ? ` by ${l.actor}` : ""} · <span className="tabular-nums">{formatDateTime(l.createdAt)}</span>
                                </div>
                                {l.changes.length > 0 && (
                                  <ul className="mt-1 space-y-0.5 pl-3">
                                    {l.changes.map((c, i) => (
                                      <li key={i} className="text-muted-foreground">
                                        <span className="text-foreground">{c.label}:</span> {c.from} <span className="text-muted-foreground">→</span> {c.to}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={del !== null} onOpenChange={(o) => !o && setDel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this schedule?</DialogTitle>
            <DialogDescription>
              The generated shifts from this pattern will be removed (manual per-day edits are kept). This can&rsquo;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
            <Button disabled={pending} onClick={handleDelete}>{pending ? "Deleting…" : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
