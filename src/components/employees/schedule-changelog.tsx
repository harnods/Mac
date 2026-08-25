"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { formatDateTime, formatWeekdayDate, updaterName } from "@/lib/format";
import type { ScheduleLog } from "@/app/actions/schedule";

export function ScheduleChangelog({ logs }: { logs: ScheduleLog[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border table-outer rounded-lg">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium"
      >
        <ChevronRight className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
        Change log
        <span className="text-muted-foreground">({logs.length})</span>
      </button>
      {open && (
        <div className="border-t px-3 py-3">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No manual schedule edits yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {logs.map((l) => (
                <li key={l.id} className="text-sm">
                  <span className="font-medium">{l.employeeName ?? "Crew"}</span>
                  <span className="text-muted-foreground"> · {formatWeekdayDate(l.work_date)}</span>
                  <span className="block text-muted-foreground">
                    {l.from_shift ?? "None"} <span className="text-muted-foreground">→</span>{" "}
                    <span className="text-foreground">{l.to_shift ?? "None"}</span>
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    by {updaterName(l.actor)} · <span className="tabular-nums">{formatDateTime(l.created_at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
