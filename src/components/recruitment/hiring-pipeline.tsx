"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, MessageCircle, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRp } from "@/lib/format";
import {
  HIRING_STAGES, HIRING_STAGE_LABEL as STAGE_LABEL, earliestJoinLabel, formatExperience, totalExperience, type HiringStage,
} from "@/lib/recruitment";
import { type Candidate, type HireComponent } from "@/app/actions/recruitment";
import { useStageMove } from "@/components/recruitment/stage-move";

function waLink(phone: string) {
  const digits = phone.replace(/[^0-9]/g, "").replace(/^0/, "62");
  return `https://wa.me/${digits}`;
}

/** Total experience, added up from the periods the candidate typed. Those are
 *  freehand, so say "~" — and when none of them parse, fall back to counting
 *  the jobs rather than inventing a number. */
function experienceLabel(c: Candidate) {
  if (c.fresh_graduate) return "Fresh graduate";
  const { months, parsed, entries } = totalExperience(c.work_experiences);
  if (parsed > 0) return `~${formatExperience(months)} experience`;
  if (entries > 0) return `${entries} past ${entries === 1 ? "job" : "jobs"}`;
  return "No experience listed";
}

export function HiringPipeline({ candidates, isAdmin, openingId, hireComponents }: { candidates: Candidate[]; isAdmin: boolean; openingId: string; hireComponents: HireComponent[] }) {
  const router = useRouter();
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [overStage, setOverStage] = useState<HiringStage | null>(null);
  const { requestMove, dialogs } = useStageMove(hireComponents);
  const boardRef = useRef<HTMLDivElement>(null);
  const scrollBoard = (dir: -1 | 1) => boardRef.current?.scrollBy({ left: dir * 304, behavior: "smooth" });

  if (candidates.length === 0) {
    return (
      <div className="rounded-lg border p-10 text-center text-sm text-muted-foreground">
        No candidates yet. Share the apply link.
      </div>
    );
  }

  return (
    <>
      <div className="mb-2 flex justify-end gap-1">
        <Button variant="outline" size="icon" aria-label="Scroll left" onClick={() => scrollBoard(-1)}><ChevronLeft className="size-4" /></Button>
        <Button variant="outline" size="icon" aria-label="Scroll right" onClick={() => scrollBoard(1)}><ChevronRight className="size-4" /></Button>
      </div>
      <div ref={boardRef} className="pipeline-scroll flex gap-4 overflow-x-scroll pb-3">
        {HIRING_STAGES.map((stage) => {
          const list = candidates.filter((c) => c.stage === stage);
          return (
            <div
              key={stage}
              onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverStage(stage); } }}
              onDragLeave={() => setOverStage((s) => (s === stage ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                const c = candidates.find((x) => x.id === dragId);
                setOverStage(null); setDragId(null);
                if (c) requestMove(c, stage);
              }}
              className={`w-72 shrink-0 rounded-lg p-1 transition-colors ${overStage === stage ? "bg-muted" : ""}`}
            >
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-sm font-semibold">{STAGE_LABEL[stage]}</span>
                <span className="text-sm text-muted-foreground tabular-nums">{list.length}</span>
              </div>
              <div className="space-y-2">
                {list.map((c) => (
                  <div
                    key={c.id}
                    draggable={isAdmin}
                    onDragStart={() => { setDragId(c.id); setDragging(true); }}
                    onDragEnd={() => { setDragId(null); setOverStage(null); setTimeout(() => setDragging(false), 0); }}
                    onClick={() => { if (!dragging) router.push(`/hr/recruitment/${openingId}/c/${c.id}`); }}
                    className={`cursor-pointer rounded-lg border bg-card p-3 hover:border-foreground/30 ${dragId === c.id ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      {c.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.photo_url} alt={c.name} className="size-10 shrink-0 rounded-full object-cover" />
                      ) : (
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-medium">{c.name}</div>
                        {c.hired_employee_id && <div className="text-sm text-emerald-600">In crew</div>}
                      </div>
                    </div>

                    <div className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                      {c.expected_salary != null && <div>Expected {formatRp(c.expected_salary)}</div>}
                      <div>{experienceLabel(c)}</div>
                      {c.height_cm != null && <div>Height {c.height_cm} cm</div>}
                      {c.earliest_join && <div>Can join: {earliestJoinLabel(c.earliest_join)}</div>}
                    </div>

                    {c.stage === "rejected" && c.reject_reason && (
                      <p className="mt-2 text-sm text-muted-foreground"><span className="font-medium">Reason:</span> {c.reject_reason}</p>
                    )}
                    {c.latest_comment && (
                      <p className="mt-2 flex items-start gap-1 text-sm text-muted-foreground">
                        <StickyNote className="mt-0.5 size-3.5 shrink-0" />
                        <span className="line-clamp-2">{c.latest_comment}</span>
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <a href={waLink(c.whatsapp)} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm hover:bg-muted">
                        <MessageCircle className="size-4" /> WA
                      </a>
                    </div>
                  </div>
                ))}
                {list.length === 0 && <div className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">—</div>}
              </div>
            </div>
          );
        })}
      </div>

      {dialogs}
    </>
  );
}
