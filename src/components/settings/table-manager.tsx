"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { QrCode, Trash2, Plus, X } from "lucide-react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { createTable, deleteTable } from "@/app/actions/tables";

export type TableRow = { id: string; name: string; code: string };

export function TableManager({ initialTables }: { initialTables: TableRow[] }) {
  const router = useRouter();
  const [tables, setTables] = useState(initialTables);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [qrTable, setQrTable] = useState<TableRow | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const origin = useRef(typeof window !== "undefined" ? window.location.origin : "");
  const filteredTables = tables.filter((t) =>
    t.name.toLowerCase().includes(q.toLowerCase()) || t.code.toLowerCase().includes(q.toLowerCase())
  );

  useEffect(() => {
    setTables(initialTables);
  }, [initialTables]);

  useEffect(() => {
    if (!qrTable) { setQrDataUrl(null); return; }
    const url = `${origin.current}/order/t/${qrTable.code}`;
    QRCode.toDataURL(url, { width: 300, margin: 2 }).then(setQrDataUrl);
  }, [qrTable]);

  function slugify(s: string) {
    return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  }

  function handleNameChange(v: string) {
    setName(v);
    setCode(slugify(v));
  }

  function add() {
    if (!name.trim() || !code.trim()) return;
    startSave(async () => {
      const res = await createTable({ name: name.trim(), code: code.trim() });
      if (!res.ok) {
        toast.error(res.error);
      } else {
        setName("");
        setCode("");
        toast.success("Meja ditambahkan");
        router.refresh();
      }
    });
  }

  function remove(id: string, tableName: string) {
    startDelete(async () => {
      const res = await deleteTable(id);
      if (!res.ok) {
        toast.error(res.error);
      } else {
        toast.success(`${tableName} dihapus`);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4 space-y-4">
        <h2 className="text-sm font-semibold">Tambah meja</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="tname">Nama meja</Label>
            <Input
              id="tname"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tcode">Kode URL</Label>
            <Input
              id="tcode"
              value={code}
              onChange={(e) => setCode(slugify(e.target.value))}
            />
          </div>
        </div>
        <Button onClick={add} disabled={saving || !name.trim() || !code.trim()} size="sm">
          <Plus className="size-4" /> Tambah
        </Button>
      </div>

      <div className="flex justify-end">
        <Input
          placeholder="Search tables..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full sm:w-56"
        />
      </div>

      {tables.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Belum ada meja. Tambahkan meja untuk generate QR code.
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No matching tables.
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {filteredTables.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground font-mono">/order/t/{t.code}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setQrTable(t)}>
                  <QrCode className="size-4" /> QR
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  disabled={deleting}
                  onClick={() => remove(t.id, t.name)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!qrTable} onOpenChange={(open) => { if (!open) setQrTable(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{qrTable?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code" className="rounded-lg border" width={260} height={260} />
            ) : (
              <div className="size-64 rounded-lg border bg-muted animate-pulse" />
            )}
            <p className="text-xs text-muted-foreground text-center break-all">
              {origin.current}/order/t/{qrTable?.code}
            </p>
            {qrDataUrl && (
              <Button asChild size="sm" variant="outline">
                <a href={qrDataUrl} download={`qr-${qrTable?.code}.png`}>
                  Download PNG
                </a>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
