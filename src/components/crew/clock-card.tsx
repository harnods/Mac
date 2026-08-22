"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clockIn, clockOut, breakStart, breakEnd } from "@/app/actions/crew-self";
import type { MyContext, PunchGeo } from "@/app/actions/crew-self";

function hhmm(t: string | null | undefined) {
  return t ? t.slice(0, 5) : "";
}

/** Best-effort current GPS position; resolves null if unavailable or denied. */
function getGeo(): Promise<PunchGeo> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  });
}

export function ClockCard({ context }: { context: MyContext }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const assigned = context.scheduledShift;
  const isWorkingDay = !!assigned?.start_time; // Day off / No schedule have no times

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
            <WifiOff className="size-4 shrink-0" /> Kamu tidak terhubung ke wifi toko — clock in/out dinonaktifkan.
          </div>
          <div className="mt-1 pl-6 text-xs opacity-80">
            IP kamu: <span className="tabular-nums">{context.detectedIp ?? "tidak terdeteksi"}</span>
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
          <div className="rounded-lg border px-3 py-2.5 text-center text-sm">
            {isWorkingDay ? (
              <>
                <span className="text-muted-foreground">Jadwal hari ini: </span>
                <span className="font-medium">
                  {assigned!.name}
                  {assigned!.start_time && assigned!.end_time ? ` (${hhmm(assigned!.start_time)}–${hhmm(assigned!.end_time)})` : ""}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">
                {assigned ? `Hari ini ${assigned.name} — tidak ada jadwal kerja.` : "Kamu tidak dijadwalkan kerja hari ini."}
              </span>
            )}
          </div>
          <Button
            className="h-14 w-full text-base"
            disabled={pending || blocked || !isWorkingDay}
            onClick={() => run(async () => clockIn(await getGeo()), "Clocked in")}
          >
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
          <Button variant="secondary" className="h-14 w-full text-base" disabled={pending || blocked} onClick={() => run(async () => clockOut(await getGeo()), "Clocked out")}>
            Clock out
          </Button>
        </div>
      )}
    </div>
  );
}
