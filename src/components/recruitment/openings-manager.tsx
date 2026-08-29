"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { MoreHorizontal, Plus, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, STICKY_ACTION_HEAD, STICKY_ACTION_CELL,
} from "@/components/ui/table";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { OpeningDrawer, type OpeningPrefill } from "@/components/recruitment/opening-drawer";
import { setOpeningStatus, deleteOpening, type OpeningRow, type RecruitmentFormData } from "@/app/actions/recruitment";

export function OpeningsManager({
  openings,
  formData,
  hireBase,
  isAdmin,
}: {
  openings: OpeningRow[];
  formData: RecruitmentFormData;
  hireBase: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<OpeningPrefill | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<OpeningRow | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function openNew() { setEditing(undefined); setDrawerOpen(true); }

  function applyUrl(code: string) { return `${hireBase.replace(/\/$/, "")}/${code}`; }

  function copyLink(code: string) {
    navigator.clipboard.writeText(applyUrl(code)).then(() => {
      setCopied(code);
      toast.success("Link copied");
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500);
    });
  }

  function toggleStatus(o: OpeningRow) {
    start(async () => {
      const res = await setOpeningStatus(o.id, o.status === "open" ? "closed" : "open");
      if (!res.ok) { toast.error(res.error); return; }
      router.refresh();
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    start(async () => {
      const res = await deleteOpening(deleteTarget.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Opening deleted");
      setDeleteTarget(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Recruitment</h1>
        {isAdmin && (
          <Button onClick={openNew}>
            <Plus className="size-4" /> New opening
          </Button>
        )}
      </div>

      <div className="border table-outer rounded-lg overflow-x-auto mt-4">
        <Table className="w-auto min-w-full table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[260px]">Opening</TableHead>
              <TableHead className="w-[140px]">Level</TableHead>
              <TableHead className="w-[140px]">Type</TableHead>
              <TableHead className="w-[110px]">Candidates</TableHead>
              <TableHead className="w-[110px]">Status</TableHead>
              <TableHead className="w-[220px]">Apply link</TableHead>
              {isAdmin && <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {openings.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-sm text-muted-foreground py-8">
                  No openings yet. Click “New opening” to start.
                </TableCell>
              </TableRow>
            )}
            {openings.map((o) => (
              <ClickableTableRow key={o.id} href={`/hr/recruitment/${o.id}`}>
                <TableCell className="font-medium">
                  <Link href={`/hr/recruitment/${o.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                    {o.title || o.position || "Opening"}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {o.department ?? "—"}
                    {o.min_experience_years > 0 ? ` · min ${o.min_experience_years} yr` : ""}
                    {o.headcount > 1 ? ` · ${o.headcount} positions` : ""}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{o.level ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-sm">{o.employment_type ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-sm tabular-nums">
                  {o.candidate_count}
                  {o.hired_count > 0 && <span className="text-muted-foreground"> · {o.hired_count} hired</span>}
                </TableCell>
                <TableCell>
                  {o.status === "open"
                    ? <Badge variant="success">Open</Badge>
                    : <Badge variant="secondary">Closed</Badge>}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-sm">
                    <span className="tabular-nums">hire.machimoto.cafe/{o.code}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); copyLink(o.code); }}
                      className="rounded p-0.5 hover:bg-muted"
                      title="Copy link"
                    >
                      {copied === o.code ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                    </button>
                  </span>
                </TableCell>
                {isAdmin && (
                  <TableCell className={STICKY_ACTION_CELL}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8" onClick={(e) => e.stopPropagation()}>
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">Menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-auto min-w-fit">
                        <DropdownMenuItem className="whitespace-nowrap" onSelect={() => router.push(`/hr/recruitment/${o.id}`)}>Edit / view details</DropdownMenuItem>
                        <DropdownMenuItem className="whitespace-nowrap" onSelect={() => toggleStatus(o)}>
                          {o.status === "open" ? "Close opening" : "Reopen"}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="whitespace-nowrap" onSelect={() => setDeleteTarget(o)}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </ClickableTableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <OpeningDrawer open={drawerOpen} onOpenChange={setDrawerOpen} formData={formData} prefill={editing} />

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{deleteTarget?.title || deleteTarget?.position}”?</DialogTitle>
            <DialogDescription>The opening and all its candidates will be deleted. This action cannot be undone.</DialogDescription>
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
