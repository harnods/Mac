"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "@/app/actions/suppliers";
import type { SupplierWithPics } from "@/lib/supabase/types";

type PicRow = { key: string; name: string; whatsapp: string };

function blankRow(): PicRow {
  return { key: crypto.randomUUID(), name: "", whatsapp: "" };
}

/** Add (supplier omitted) or edit a supplier and its PICs. */
export function SupplierFormDialog({
  open,
  onOpenChange,
  supplier,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: SupplierWithPics | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {supplier ? "Edit supplier" : "Add supplier"}
          </DialogTitle>
          <DialogDescription>
            Data supplier & PIC (bisa lebih dari satu).
          </DialogDescription>
        </DialogHeader>
        {/* Content unmounts when closed, so the form re-initializes on every open. */}
        <SupplierForm
          key={supplier?.id ?? "new"}
          supplier={supplier ?? null}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function SupplierForm({
  supplier,
  onDone,
}: {
  supplier: SupplierWithPics | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(supplier?.name ?? "");
  const [pics, setPics] = useState<PicRow[]>(() =>
    supplier?.supplier_pics.length
      ? supplier.supplier_pics.map((p) => ({
          key: p.id,
          name: p.name,
          whatsapp: p.whatsapp ?? "",
        }))
      : [blankRow()],
  );

  function updatePic(key: string, patch: Partial<PicRow>) {
    setPics((rows) =>
      rows.map((p) => (p.key === key ? { ...p, ...patch } : p)),
    );
  }

  function submit() {
    const payload = {
      name: name.trim(),
      pics: pics
        .filter((p) => p.name.trim())
        .map((p) => ({ name: p.name.trim(), whatsapp: p.whatsapp.trim() })),
    };
    start(async () => {
      const res = supplier
        ? await updateSupplier(supplier.id, payload)
        : await createSupplier(payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(supplier ? "Supplier saved" : "Supplier added");
      onDone();
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="sup-name">Nama supplier</Label>
        <Input
          id="sup-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          placeholder="e.g. CV Sumber Segar"
        />
      </div>

      <div className="space-y-2">
        <Label>PIC</Label>
        <div className="space-y-2">
          {pics.map((p) => (
            <div key={p.key} className="flex items-center gap-2">
              <Input
                value={p.name}
                onChange={(e) => updatePic(p.key, { name: e.target.value })}
                placeholder="Nama PIC"
                maxLength={80}
                className="flex-1"
              />
              <Input
                value={p.whatsapp}
                onChange={(e) => updatePic(p.key, { whatsapp: e.target.value })}
                placeholder="No. WhatsApp"
                inputMode="tel"
                maxLength={30}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() =>
                  setPics((rows) => rows.filter((r) => r.key !== p.key))
                }
                aria-label="Hapus PIC"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPics((rows) => [...rows, blankRow()])}
        >
          <Plus className="size-4" /> Tambah PIC
        </Button>
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="ghost">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending ? "Saving..." : supplier ? "Save changes" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function SupplierDeleteDialog({
  supplier,
  open,
  onOpenChange,
  redirectAfter,
}: {
  supplier: { id: string; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Navigate here after deleting (e.g. back to the list from the detail page). */
  redirectAfter?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function remove() {
    if (!supplier) return;
    start(async () => {
      const res = await deleteSupplier(supplier.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Supplier deleted");
      onOpenChange(false);
      if (redirectAfter) router.push(redirectAfter);
      else router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Hapus &ldquo;{supplier?.name}&rdquo;?</DialogTitle>
          <DialogDescription>
            PIC dan daftar ingredient supplier ini akan ikut terhapus.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={remove} disabled={pending}>
            {pending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
