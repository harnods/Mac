"use client";

import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { formatRp } from "@/lib/format";
import type { LateInfo } from "@/app/actions/crew-self";

export function LateClockInSheet({
  info,
  shiftName,
  open,
  onOpenChange,
}: {
  info: LateInfo | null;
  shiftName?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>⏰ Kamu telat hari ini</SheetTitle>
        </SheetHeader>
        {info && (
          <SheetBody className="space-y-4 text-sm">
            <p>
              Kamu clock in pukul <b className="tabular-nums">{info.clockIn}</b>, padahal shift
              {shiftName ? <> <b>{shiftName}</b></> : null} mulai pukul <b className="tabular-nums">{info.shiftStart}</b>.
              Idealnya clock in <b>10 menit sebelum</b> shift dimulai — paling lambat pukul{" "}
              <b className="tabular-nums">{info.expectedBy}</b>.
            </p>

            <div className="space-y-1.5 rounded-lg border p-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">Telat bulan ini</span>
                <b className="tabular-nums">{info.lateCount}×</b>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">Potongan sampai hari ini</span>
                <b className="tabular-nums text-red-600 dark:text-red-400">−{formatRp(info.deduction)}</b>
              </div>
              {info.rate > 0 && (
                <p className="text-xs text-muted-foreground">
                  {info.lateCount} × {formatRp(info.rate)} per keterlambatan
                </p>
              )}
            </div>

            <p className="text-muted-foreground">Yuk, usahakan datang lebih awal ya 🙌</p>
          </SheetBody>
        )}
        <SheetFooter>
          <Button className="h-12 w-full text-base" onClick={() => onOpenChange(false)}>
            Saya mengerti
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
