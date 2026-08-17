"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { MoreHorizontal, ChevronRight, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow, STICKY_ACTION_CELL } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatDate, formatId } from "@/lib/format";
import { formatNum, parseDecimal } from "@/lib/units";
import { updatePurchaseRequestItem, submitDraftRequest } from "@/app/actions/purchasing";
import { PurchaseRequestDeleteDialog } from "./purchase-request-delete-dialog";
import type { PurchaseRequestStatus, Updater } from "@/lib/supabase/types";

const STATUS_LABEL: Record<PurchaseRequestStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

type ItemStatus = "pending" | "approved" | "rejected";

export type RequestRowItem = {
  id: string;
  qty: number;
  unit: string;
  status: ItemStatus;
  supplier_id: string | null;
  available_snapshot: number | null;
  available_unit: string | null;
  item: { name: string; unit: string } | null;
};

type Props = {
  id: string;
  status: PurchaseRequestStatus;
  items: RequestRowItem[];
  note: string | null;
  creator: Updater | null;
  createdAt: string;
  isAdmin: boolean;
  canApprove: boolean;
  suppliers: { id: string; name: string }[];
  isOwn: boolean;
  colSpan: number;
  showStatus?: boolean;
  showRequestor?: boolean;
  showRequestDate?: boolean;
  showItems?: boolean;
  showNote?: boolean;
};

function statusBadge(status: ItemStatus | PurchaseRequestStatus) {
  return (
    <Badge variant={
      status === "approved" ? "success" :
      status === "rejected" ? "destructive" :
      status === "draft" ? "outline" :
      "secondary"
    }>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

/** Request-level display derived from per-item statuses. Adds a "Partial" state
 *  when some items are decided but others are still pending. */
function requestStatusDisplay(status: PurchaseRequestStatus, items: RequestRowItem[]) {
  const total = items.length;
  if (status === "draft" || total === 0) {
    return { label: STATUS_LABEL[status], variant: status === "draft" ? "outline" as const : "secondary" as const, note: null as string | null };
  }
  const approved = items.filter((i) => i.status === "approved").length;
  const rejected = items.filter((i) => i.status === "rejected").length;
  const pending = total - approved - rejected;
  const note = total > 1 ? `${approved}/${total} approved` : null;

  if (pending === total) return { label: "Pending", variant: "secondary" as const, note };
  if (rejected === total) return { label: "Rejected", variant: "destructive" as const, note: null };
  if (pending === 0) return { label: "Approved", variant: "success" as const, note };
  return { label: "Partial", variant: "secondary" as const, note };
}

export function PurchaseRequestRow({
  id, status, items, note, creator, createdAt, isAdmin, canApprove, suppliers, isOwn, colSpan,
  showStatus = true, showRequestor = true, showRequestDate = true, showItems = true, showNote = true,
}: Props) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [submitting, startSubmit] = useTransition();
  const canDelete = isAdmin || (isOwn && (status === "pending" || status === "draft"));
  const canEditDraft = status === "draft" && (isOwn || isAdmin);
  const requestorLabel = creator?.full_name ?? creator?.email ?? "—";
  const hasMenu = canEditDraft || canDelete;

  function submitDraft() {
    startSubmit(async () => {
      const res = await submitDraftRequest(id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Request submitted");
      router.refresh();
    });
  }

  return (
    <>
      <TableRow
        onClick={() => setOpen((o) => !o)}
        className="cursor-pointer hover:bg-muted/50"
        aria-expanded={open}
      >
        <TableCell className="p-0 text-center">
          <ChevronRight className={cn("mx-auto size-4 text-muted-foreground transition-transform", open && "rotate-90")} />
        </TableCell>
        <TableCell className="font-medium tabular-nums">{formatId(id)}</TableCell>
        {showStatus && (
          <TableCell>
            {(() => {
              const d = requestStatusDisplay(status, items);
              return (
                <div className="flex flex-col gap-0.5">
                  <Badge variant={d.variant} className="w-fit">{d.label}</Badge>
                  {d.note && <span className="text-xs text-muted-foreground tabular-nums">{d.note}</span>}
                </div>
              );
            })()}
          </TableCell>
        )}
        {showRequestor && <TableCell className="text-sm truncate">{requestorLabel}</TableCell>}
        {showRequestDate && <TableCell className="text-sm tabular-nums">{formatDate(createdAt)}</TableCell>}
        {showItems && <TableCell className="tabular-nums">{items.length}</TableCell>}
        {showNote && <TableCell className="text-sm text-muted-foreground truncate">{note ?? "—"}</TableCell>}
        <TableCell />
        <TableCell className={STICKY_ACTION_CELL} onClick={(e) => e.stopPropagation()}>
          {hasMenu ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEditDraft && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href={`/purchasing/requests/${id}/edit`}>Edit draft</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={submitting} onSelect={submitDraft}>Submit request</DropdownMenuItem>
                  </>
                )}
                {canEditDraft && canDelete && <DropdownMenuSeparator />}
                {canDelete && <DropdownMenuItem onSelect={() => setDeleteOpen(true)}>Delete</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="size-8" />
          )}
        </TableCell>
      </TableRow>

      {open && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell />
          <TableCell colSpan={colSpan - 1} className="py-3">
            {items.length === 0 ? (
              <div className="text-sm text-muted-foreground">No items.</div>
            ) : (
              <div className="overflow-x-auto pr-4">
                <table className="w-full min-w-[820px] text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="py-1 pr-3 text-left font-medium">Item</th>
                      <th className="py-1 px-3 text-right font-medium w-[150px]">Requested</th>
                      <th className="py-1 px-3 text-right font-medium w-[150px]">Available at request</th>
                      <th className="py-1 px-3 text-left font-medium w-[200px]">Supplier</th>
                      <th className="py-1 pl-3 text-right font-medium w-[300px]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <RequestItemRow key={it.id} item={it} canApprove={canApprove} suppliers={suppliers} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TableCell>
        </TableRow>
      )}

      <PurchaseRequestDeleteDialog id={id} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}

function RequestItemRow({
  item,
  canApprove,
  suppliers,
}: {
  item: RequestRowItem;
  canApprove: boolean;
  suppliers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [qty, setQty] = useState(item.qty != null ? String(item.qty) : "");

  const available = item.available_snapshot ?? 0;
  const availableLabel = `${formatNum(Number(available))} ${item.available_unit ?? item.item?.unit ?? ""}`.trim();
  const supplierName = suppliers.find((s) => s.id === item.supplier_id)?.name ?? "—";

  function save(patch: { qty?: number | null; supplier_id?: string | null; status?: ItemStatus }, okMsg?: string) {
    start(async () => {
      const res = await updatePurchaseRequestItem(item.id, patch);
      if (!res.ok) { toast.error(res.error); return; }
      if (okMsg) toast.success(okMsg);
      router.refresh();
    });
  }

  function saveQtyOnBlur() {
    const parsed = qty.trim() ? parseDecimal(qty) : null;
    if (parsed === item.qty) return;
    if (parsed == null || parsed <= 0) { toast.error("Qty harus lebih dari 0"); setQty(String(item.qty ?? "")); return; }
    save({ qty: parsed }, "Qty diperbarui");
  }

  return (
    <tr className="border-b border-dashed last:border-0">
      <td className="py-1.5 pr-3">{item.item?.name ?? "—"}</td>

      {/* Requested qty */}
      <td className="py-1.5 px-3 text-right">
        {canApprove ? (
          <div className="flex items-center justify-end gap-1.5">
            <DecimalInput
              min="0"
              step="any"
              value={qty}
              onValueChange={setQty}
              onBlur={saveQtyOnBlur}
              disabled={pending}
              className="h-8 w-24 text-right"
            />
            <span className="text-muted-foreground w-10 text-left">{item.unit}</span>
          </div>
        ) : (
          <span className="tabular-nums">{item.qty ? `${formatNum(Number(item.qty))} ${item.unit}` : "—"}</span>
        )}
      </td>

      {/* Available at request (snapshot) */}
      <td className="py-1.5 px-3 text-right tabular-nums text-muted-foreground">{availableLabel}</td>

      {/* Supplier */}
      <td className="py-1.5 px-3">
        {canApprove ? (
          <Select
            value={item.supplier_id ?? "none"}
            onValueChange={(v) => save({ supplier_id: v === "none" ? null : v }, "Supplier diperbarui")}
            disabled={pending}
          >
            <SelectTrigger className="h-8 w-full"><SelectValue placeholder="Pilih supplier" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Tanpa supplier</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span>{supplierName}</span>
        )}
      </td>

      {/* Status + per-item approve/reject */}
      <td className="py-1.5 pl-3">
        <div className="flex items-center justify-end gap-2">
          {statusBadge(item.status)}
          {canApprove && (
            <div className="flex gap-1.5">
              <Button
                type="button"
                variant="outline"
                className="text-green-600 hover:text-green-700"
                disabled={pending || item.status === "approved"}
                onClick={() => save({ status: "approved" }, "Item disetujui")}
              >
                <Check className="size-4" /> Approve
              </Button>
              <Button
                type="button"
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={pending || item.status === "rejected"}
                onClick={() => save({ status: "rejected" }, "Item ditolak")}
              >
                <X className="size-4" /> Reject
              </Button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
