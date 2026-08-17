"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Printer, QrCode, SquarePen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

  function reset() {
    setSelected(null);
  }

  function printQr() {
    if (!selected) return;
    window.open(`/orders/qr/${selected.code}`, "_blank", "noopener");
    setOpen(false);
    reset();
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
          <div className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto py-1 sm:grid-cols-4">
            {tables.map((t) => {
              const active = selected?.id === t.id;
              const occupied = occupiedTableIds.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelected(t)}
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-lg border p-1 text-center text-sm font-medium transition-colors ${
                    active ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary hover:bg-accent"
                  }`}
                >
                  <span className="line-clamp-2 leading-tight">{t.name}</span>
                  {occupied && (
                    <Badge
                      variant={active ? "secondary" : "outline"}
                      className="mt-1 h-4 px-1 text-[9px] font-medium"
                    >
                      Terisi
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={manualOrder} disabled={!selected}>
            <SquarePen className="size-4" /> Manual order
          </Button>
          <Button onClick={printQr} disabled={!selected}>
            <Printer className="size-4" /> <QrCode className="size-4" /> Print QR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
