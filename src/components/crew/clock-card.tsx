"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { clockIn, clockOut, breakStart, breakEnd } from "@/app/actions/crew-self";
import type { MyContext } from "@/app/actions/crew-self";

function hhmm(t: string | null | undefined) {
  return t ? t.slice(0, 5) : "";
}

export function ClockCard({ context }: { context: MyContext }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [shiftId, setShiftId] = useState("");

  const t = context.today;
  const open = !!t && !!t.clock_in && !t.clock_out;
  const onBreak = open && !!t.break_start;
  const completed = !!t && !!t.clock_out;
  const blocked = !context.onStoreNetwork;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) { toast.error(res.error ?? "Something went wrong"); return; }
      toast.success(ok);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {blocked && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <WifiOff className="size-4 shrink-0" /> You&rsquo;re not on the store wifi — clocking is disabled.
          </div>
          <div className="mt-1 pl-6 text-xs opacity-80">
            Your IP: <span className="tabular-nums">{context.detectedIp ?? "not detected"}</span>
          </div>
        </div>
      )}

      {/* Status */}
      <div className="rounded-xl border p-5 text-center">
        {onBreak ? (
          <>
            <div className="text-sm text-muted-foreground">On break since</div>
            <div className="text-3xl font-semibold tabular-nums">{hhmm(t!.break_start)}</div>
            <div className="mt-1 text-sm text-muted-foreground">{t!.shifts?.name} · in since {hhmm(t!.clock_in)}</div>
          </>
        ) : open ? (
          <>
            <div className="text-sm text-muted-foreground">Clocked in since</div>
            <div className="text-3xl font-semibold tabular-nums">{hhmm(t!.clock_in)}</div>
            <div className="mt-1 text-sm text-muted-foreground">{t!.shifts?.name ?? "No shift"}</div>
          </>
        ) : completed ? (
          <>
            <div className="text-sm text-muted-foreground">Done for today</div>
            <div className="text-3xl font-semibold tabular-nums">{hhmm(t!.clock_in)}–{hhmm(t!.clock_out)}</div>
            <div className="mt-1 text-sm text-muted-foreground">{t!.shifts?.name ?? "No shift"} · break {t!.break_minutes}m</div>
          </>
        ) : (
          <>
            <div className="text-sm text-muted-foreground">Not clocked in</div>
            <div className="text-3xl font-semibold">—</div>
          </>
        )}
      </div>

      {/* Actions */}
      {!open ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="shift">Shift</Label>
            <Select value={shiftId} onValueChange={setShiftId}>
              <SelectTrigger id="shift" className="h-12 w-full text-base"><SelectValue placeholder="Choose your shift" /></SelectTrigger>
              <SelectContent>
                {context.shifts.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}{s.start_time && s.end_time ? ` (${hhmm(s.start_time)}–${hhmm(s.end_time)})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="h-14 w-full text-base" disabled={pending || blocked || !shiftId} onClick={() => run(() => clockIn(shiftId), "Clocked in")}>
            Clock in
          </Button>
          {completed && <p className="text-center text-xs text-muted-foreground">Clocking in again starts a new session.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {onBreak ? (
            <Button className="h-14 w-full text-base" disabled={pending || blocked} onClick={() => run(breakEnd, "Break ended")}>
              End break
            </Button>
          ) : (
            <Button variant="outline" className="h-14 w-full text-base" disabled={pending || blocked} onClick={() => run(breakStart, "Break started")}>
              Start break
            </Button>
          )}
          <Button variant="secondary" className="h-14 w-full text-base" disabled={pending || blocked} onClick={() => run(clockOut, "Clocked out")}>
            Clock out
          </Button>
        </div>
      )}
    </div>
  );
}
