"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Qty } from "@/components/ui/qty";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { updateCountItemNote } from "@/app/actions/stock";

export type CompletedCountItem = {
  id: string;
  qty_system: number;
  qty_counted: number | null;
  unit: string;
  note: string | null;
  item: { name: string; brand: string | null; type: string } | null;
};

const TYPE_LABEL: Record<string, string> = {
  ingredient: "Ingredient",
  supply: "Asset",
  product: "Product",
  prep_item: "Prep item",
};

const ALL = "__all__";

function NoteCell({ itemId, note, canEdit }: { itemId: string; note: string | null; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(note ?? "");
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    const res = await updateCountItemNote(itemId, val);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Note saved");
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="group/note flex items-start justify-between gap-2">
      <span className={note ? "" : "text-muted-foreground"}>{note || "—"}</span>
      {canEdit && (
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setVal(note ?? ""); }}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="shrink-0 opacity-0 group-hover/note:opacity-100" aria-label="Edit note">
              <Pencil className="size-3.5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Edit note</DialogTitle>
            </DialogHeader>
            <Textarea value={val} onChange={(e) => setVal(e.target.value)} rows={3} maxLength={300} placeholder="Add a note…" />
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button onClick={save} disabled={pending}>{pending ? "Saving..." : "Save"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export function CompletedCountTable({ items, canEdit }: { items: CompletedCountItem[]; canEdit: boolean }) {
  const [cat, setCat] = useState(ALL);
  const [q, setQ] = useState("");

  const types = useMemo(
    () => [...new Set(items.map((i) => i.item?.type).filter((t): t is string => !!t))],
    [items],
  );

  const shown = useMemo(
    () =>
      items.filter(
        (i) =>
          (cat === ALL || i.item?.type === cat) &&
          (i.item?.name ?? "").toLowerCase().includes(q.trim().toLowerCase()),
      ),
    [items, cat, q],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_LABEL[t] ?? t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search items..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="table-outer overflow-x-auto rounded-lg border">
        <Table className="w-auto min-w-full table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[240px]">Item</TableHead>
              <TableHead className="w-[140px]">Category</TableHead>
              <TableHead className="w-[150px] text-right">System qty</TableHead>
              <TableHead className="w-[150px] text-right">Counted qty</TableHead>
              <TableHead className="w-[150px] text-right">Variance</TableHead>
              <TableHead className="w-[220px]">Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No matching items.
                </TableCell>
              </TableRow>
            )}
            {shown.map((row) => {
              const counted = row.qty_counted;
              const variance = counted != null ? counted - row.qty_system : null;
              return (
                <TableRow key={row.id}>
                  <TableCell className="font-medium truncate">
                    {row.item?.name ?? "Deleted item"}
                    {row.item?.brand && <span className="block text-xs font-normal text-muted-foreground truncate">{row.item.brand}</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{TYPE_LABEL[row.item?.type ?? ""] ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Qty value={row.qty_system} unit={row.unit} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {counted != null ? <Qty value={counted} unit={row.unit} /> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {variance == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span
                        className={cn(
                          variance > 0
                            ? "text-green-600 dark:text-green-400"
                            : variance < 0
                              ? "text-destructive"
                              : "text-muted-foreground",
                        )}
                      >
                        {variance > 0 ? "+" : ""}
                        <Qty value={variance} unit={row.unit} />
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <NoteCell itemId={row.id} note={row.note} canEdit={canEdit} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
