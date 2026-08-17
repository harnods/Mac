"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Trash2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, STICKY_ACTION_HEAD, STICKY_ACTION_CELL,
} from "@/components/ui/table";
import { createSupplier, updateSupplier, deleteSupplier } from "@/app/actions/suppliers";
import type { SupplierWithPics } from "@/lib/supabase/types";

type PicRow = { key: string; name: string; whatsapp: string };
type FormState = { id?: string; name: string; pics: PicRow[] };

function waLink(whatsapp: string): string {
  const digits = whatsapp.replace(/[^\d]/g, "").replace(/^0/, "62");
  return `https://wa.me/${digits}`;
}

function blankRow(): PicRow {
  return { key: crypto.randomUUID(), name: "", whatsapp: "" };
}

export function SuppliersManager({ suppliers, canEdit }: { suppliers: SupplierWithPics[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState<FormState | null>(null);
  const [del, setDel] = useState<SupplierWithPics | null>(null);

  function openAdd() {
    setForm({ name: "", pics: [blankRow()] });
  }
  function openEdit(s: SupplierWithPics) {
    setForm({
      id: s.id,
      name: s.name,
      pics: s.supplier_pics.length
        ? s.supplier_pics.map((p) => ({ key: p.id, name: p.name, whatsapp: p.whatsapp ?? "" }))
        : [blankRow()],
    });
  }

  function updatePic(key: string, patch: Partial<PicRow>) {
    setForm((f) => (f ? { ...f, pics: f.pics.map((p) => (p.key === key ? { ...p, ...patch } : p)) } : f));
  }
  function addPic() {
    setForm((f) => (f ? { ...f, pics: [...f.pics, blankRow()] } : f));
  }
  function removePic(key: string) {
    setForm((f) => (f ? { ...f, pics: f.pics.filter((p) => p.key !== key) } : f));
  }

  function submit() {
    if (!form) return;
    const payload = {
      name: form.name.trim(),
      pics: form.pics.filter((p) => p.name.trim()).map((p) => ({ name: p.name.trim(), whatsapp: p.whatsapp.trim() })),
    };
    start(async () => {
      const res = form.id ? await updateSupplier(form.id, payload) : await createSupplier(payload);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(form.id ? "Supplier saved" : "Supplier added");
      setForm(null);
      router.refresh();
    });
  }

  function remove() {
    if (!del) return;
    start(async () => {
      const res = await deleteSupplier(del.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Supplier deleted");
      setDel(null);
      router.refresh();
    });
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

      {suppliers.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">Belum ada supplier.</div>
      ) : (
        <div className="border table-outer rounded-lg overflow-x-auto">
          <Table className="w-auto min-w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[260px]">Supplier</TableHead>
                <TableHead>PIC &amp; WhatsApp</TableHead>
                <TableHead className="w-0 p-0" />
                <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium align-top">{s.name}</TableCell>
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
                  <TableCell />
                  <TableCell className={STICKY_ACTION_CELL}>
                    {canEdit && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => openEdit(s)}>Edit</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => setDel(s)}>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add / Edit */}
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Edit supplier" : "Add supplier"}</DialogTitle>
            <DialogDescription>Data supplier & PIC (bisa lebih dari satu).</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sup-name">Nama supplier</Label>
              <Input
                id="sup-name"
                required
                value={form?.name ?? ""}
                onChange={(e) => setForm((f) => (f ? { ...f, name: e.target.value } : f))}
                maxLength={120}
                placeholder="e.g. CV Sumber Segar"
              />
            </div>

            <div className="space-y-2">
              <Label>PIC</Label>
              <div className="space-y-2">
                {form?.pics.map((p) => (
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
                      onClick={() => removePic(p.key)}
                      aria-label="Hapus PIC"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addPic}>
                <Plus className="size-4" /> Tambah PIC
              </Button>
            </div>

            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
              <Button type="submit" disabled={pending || !form?.name.trim()}>
                {pending ? "Saving..." : form?.id ? "Save changes" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus &ldquo;{del?.name}&rdquo;?</DialogTitle>
            <DialogDescription>PIC supplier ini akan ikut terhapus.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDel(null)}>Cancel</Button>
            <Button onClick={remove} disabled={pending}>{pending ? "Deleting..." : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
