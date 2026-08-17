"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Printer, QrCode, SquarePen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildTableQrDocket } from "@/lib/escpos";
import { getPairedPrinters, printToPaired } from "@/lib/printer";
import { tableOrderUrl } from "@/lib/order-url";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PosTable } from "./pos-bills-board";

export function NewOrderModal({
  tables,
  occupiedTableIds,
}: {
  tables: PosTable[];
  occupiedTableIds: Set<string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PosTable | null>(null);
  const [printing, setPrinting] = useState(false);

  function reset() {
    setSelected(null);
  }

  async function printQr() {
    if (!selected) return;
    const url = tableOrderUrl(selected.code);

    // No paired thermal printer → fall back to a browser-printable tent card.
    if (getPairedPrinters().length === 0) {
      toast.info("Belum ada printer yang di-pair — membuka print manual");
      window.open(`/orders/qr/${selected.code}`, "_blank", "noopener");
      setOpen(false);
      reset();
      return;
    }

    setPrinting(true);
    try {
      await printToPaired(buildTableQrDocket(selected.name, url));
      toast.success(`QR ${selected.name} tercetak`);
      setOpen(false);
      reset();
    } catch (err) {
      const msg = (err as Error).message;
      if (!/cancelled|User cancelled/i.test(msg)) toast.error(`Gagal print: ${msg}`);
    } finally {
      setPrinting(false);
    }
  }

  function manualOrder() {
    if (!selected) return;
    router.push(`/orders/new?table=${selected.code}`);
    setOpen(false);
    reset();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> New order
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New order</DialogTitle>
          <DialogDescription>Pilih meja, lalu print QR untuk customer pesan sendiri, atau input manual.</DialogDescription>
        </DialogHeader>

        {tables.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Belum ada meja. Tambahkan di Settings → Tables &amp; QR.
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>Meja</Label>
            <Select
              value={selected?.id ?? ""}
              onValueChange={(id) => setSelected(tables.find((t) => t.id === id) ?? null)}
            >
              <SelectTrigger><SelectValue placeholder="Pilih meja" /></SelectTrigger>
              <SelectContent>
                {tables.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {occupiedTableIds.has(t.id) ? " · Terisi" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={manualOrder} disabled={!selected || printing}>
            <SquarePen className="size-4" /> Manual order
          </Button>
          <Button onClick={printQr} disabled={!selected || printing}>
            {printing ? (
              <>Printing…</>
            ) : (
              <>
                <Printer className="size-4" /> <QrCode className="size-4" /> Print QR
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
