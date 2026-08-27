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
              Kamu clock in pukul {info.clockIn}, padahal shift{shiftName ? ` ${shiftName}` : ""} mulai pukul{" "}
              {info.shiftStart}. Idealnya clock in 10 menit sebelum shift dimulai — paling lambat pukul {info.expectedBy}.
            </p>

            <p>Bulan ini kamu sudah telat {info.lateCount} kali.</p>

            <p>
              Total potongan keterlambatan sampai hari ini: {formatRp(info.deduction)}
              {info.rate > 0 ? ` (${info.lateCount} × ${formatRp(info.rate)})` : ""}.
            </p>

            <p>Yuk, usahakan datang lebih awal ya 🙌</p>
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
