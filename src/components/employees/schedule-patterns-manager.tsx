"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Plus } from "lucide-react";
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
import { formatDate } from "@/lib/format";
import { deleteRosterPattern } from "@/app/actions/schedule";

type Pattern = { id: string; name: string | null; effective_date: string };

export function SchedulePatternsManager({ patterns, isAdmin }: { patterns: Pattern[]; isAdmin: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [del, setDel] = useState<Pattern | null>(null);

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
              <TableHead className="w-[180px]">Effective date</TableHead>
              <TableHead className="w-[280px]">Name</TableHead>
              {isAdmin && <TableHead className="p-0" />}
              {isAdmin && <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {patterns.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 4 : 2} className="text-center text-sm text-muted-foreground py-8">
                  No schedules yet.
                </TableCell>
              </TableRow>
            )}
            {patterns.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">
                  <Link href={`/hr/schedule-patterns/${p.id}`} className="hover:underline">{formatDate(p.effective_date)}</Link>
                </TableCell>
                <TableCell className="text-sm">{p.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                {isAdmin && <TableCell className="p-0" />}
                {isAdmin && (
                  <TableCell className={STICKY_ACTION_CELL}>
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
            ))}
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
