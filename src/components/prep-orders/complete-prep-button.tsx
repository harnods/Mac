"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatNum, parseDecimal } from "@/lib/units";
import { completePrepOrder } from "@/app/actions/prep-orders";

type Props = {
  id: string;
  targetQty: number;
  unit: string;
};

export function CompletePrepButton({ id, targetQty, unit }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [actualQty, setActualQty] = useState("");
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  const actual = parseDecimal(actualQty);
  const validActual = !isNaN(actual) && actual > 0;
  const variance = validActual ? actual - targetQty : null;
  const hasVariance = variance !== null && variance !== 0;
  const canSubmit = validActual && (!hasVariance || reason.trim().length > 0);

  function handleOpen() {
    setActualQty("");
    setReason("");
    setOpen(true);
  }

  function handleSubmit() {
    if (!canSubmit) return;
    start(async () => {
      const res = await completePrepOrder(id, actual, hasVariance ? reason.trim() : undefined);
      if (!res.ok) {
        toast.error(res.error);
      } else {
        toast.success("Prep order completed");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button size="sm" onClick={handleOpen}>
        Complete
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Complete prep order</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="text-sm text-muted-foreground">
              Target: <span className="font-medium text-foreground">{formatNum(targetQty)} {unit}</span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="actual-qty">Actual yield</Label>
              <div className="flex items-center gap-2">
                <DecimalInput
                  id="actual-qty"
                  min="0.001"
                  step="any"
                  placeholder={String(targetQty)}
                  value={actualQty}
                  onValueChange={(v) => setActualQty(v)}
                  className="w-32"
                  autoFocus
                />
                <span className="text-sm text-muted-foreground">{unit}</span>
              </div>
            </div>

            {/* Variance feedback */}
            {variance !== null && (
              <div className={`flex items-start gap-2 rounded-md px-3 py-2.5 text-sm ${
                variance === 0
                  ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400"
                  : variance < 0
                  ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
              }`}>
                {variance === 0 ? (
                  <>
                    <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                    <span>On target</span>
                  </>
                ) : variance < 0 ? (
                  <>
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                    <span>
                      Waste: <strong>{formatNum(Math.abs(variance))} {unit}</strong> below target
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                    <span>
                      Non-standard: <strong>{formatNum(variance)} {unit}</strong> above target
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Reason — required when there's a variance */}
            {hasVariance && (
              <div className="space-y-1.5">
                <Label htmlFor="reason">
                  Reason <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="reason"
                  placeholder={variance! < 0 ? "e.g. Chicken damaged during trimming" : "e.g. Portions were smaller than standard"}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  maxLength={300}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={pending || !canSubmit}>
              {pending ? "Completing..." : "Complete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
