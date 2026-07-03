"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRp } from "@/lib/format";
import { updateLoyaltySettings } from "@/app/actions/loyalty";

export function LoyaltySettingsForm({ rpPerPoint }: { rpPerPoint: number }) {
  const [value, setValue] = useState(String(rpPerPoint));
  const [saving, startSave] = useTransition();

  const parsed = parseInt(value, 10);
  const valid = !isNaN(parsed) && parsed >= 100;
  const examplePoints = valid ? Math.floor(50000 / parsed) : 0;

  function save() {
    if (!valid) return;
    startSave(async () => {
      const res = await updateLoyaltySettings(parsed);
      if (!res.ok) {
        toast.error(res.error);
      } else {
        toast.success("Loyalty settings disimpan");
      }
    });
  }

  return (
    <div className="rounded-lg border p-5 space-y-5">
      <div className="space-y-2">
        <Label htmlFor="rpp">Rupiah per 1 Point</Label>
        <div className="flex gap-2 items-center">
          <span className="text-sm text-muted-foreground">Rp</span>
          <Input
            id="rpp"
            type="number"
            min={100}
            step={100}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="max-w-[160px]"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Minimal Rp 100. Contoh: isi <strong>1000</strong> berarti setiap Rp 1.000 = 1 point.
        </p>
      </div>

      {valid && (
        <div className="rounded-md bg-muted px-4 py-3 text-sm">
          Transaksi <strong>{formatRp(50000)}</strong> → pelanggan dapat{" "}
          <strong className="text-amber-600">{examplePoints} points</strong>
        </div>
      )}

      <Button onClick={save} disabled={saving || !valid}>
        {saving ? "Menyimpan..." : "Simpan"}
      </Button>
    </div>
  );
}
