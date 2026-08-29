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
import { setOpeningStatus, deleteOpening, getOpeningDetail, type OpeningRow, type RecruitmentFormData } from "@/app/actions/recruitment";

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

  function openEdit(o: OpeningRow) {
    start(async () => {
      const d = await getOpeningDetail(o.id);
      if (!d) { toast.error("Could not load opening"); return; }
      const op = d.opening;
      setEditing({
        id: op.id, title: op.title,
        job_position_id: op.job_position_id, department_id: op.department_id,
        job_level_id: op.job_level_id, employment_status_id: op.employment_status_id,
        min_experience_years: op.min_experience_years, headcount: op.headcount,
        require_physical: op.require_physical, min_height_cm: op.min_height_cm, min_weight_kg: op.min_weight_kg,
        description: op.description,
      });
      setDrawerOpen(true);
    });
  }

  function copyGlobal() {
    navigator.clipboard.writeText(hireBase).then(() => {
      setCopied("__global__");
      toast.success("Link copied");
      setTimeout(() => setCopied((c) => (c === "__global__" ? null : c)), 1500);
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

      <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
        <span>Apply link (all positions):</span>
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <span className="tabular-nums">{hireBase.replace(/^https?:\/\//, "")}</span>
          <button type="button" onClick={() => copyGlobal()} className="rounded p-0.5 hover:bg-muted" title="Copy link">
            {copied === "__global__" ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
          </button>
        </span>
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
              {isAdmin && <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {openings.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-sm text-muted-foreground py-8">
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
                        <DropdownMenuItem className="whitespace-nowrap" onSelect={() => router.push(`/hr/recruitment/${o.id}`)}>View details</DropdownMenuItem>
                        <DropdownMenuItem className="whitespace-nowrap" onSelect={() => openEdit(o)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem className="whitespace-nowrap" onSelect={() => toggleStatus(o)}>
                          {o.status === "open" ? "Close opening" : "Reopen"}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="whitespace-nowrap" onSelect={(e) => { e.preventDefault(); setTimeout(() => setDeleteTarget(o), 0); }}>Delete</DropdownMenuItem>
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
