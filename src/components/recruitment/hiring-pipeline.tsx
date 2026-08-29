"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { formatRp } from "@/lib/format";
import { HIRING_STAGES, HIRING_STAGE_LABEL as STAGE_LABEL, type HiringStage } from "@/lib/recruitment";
import { setCandidateStage, getResumeSignedUrl, type Candidate } from "@/app/actions/recruitment";

function waLink(phone: string) {
  const digits = phone.replace(/[^0-9]/g, "").replace(/^0/, "62");
  return `https://wa.me/${digits}`;
}

export function HiringPipeline({ candidates, isAdmin }: { candidates: Candidate[]; isAdmin: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<HiringStage | null>(null);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [rejectFor, setRejectFor] = useState<Candidate | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  function move(c: Candidate, stage: HiringStage, reason?: string) {
    if (stage === c.stage && stage !== "rejected") return;
    start(async () => {
      const res = await setCandidateStage(c.id, stage, reason);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(stage === "hired" ? `${c.name} hired — added to crew` : `Moved to ${STAGE_LABEL[stage]}`);
      router.refresh();
    });
  }

  function requestMove(c: Candidate, stage: HiringStage) {
    if (stage === c.stage) return;
    if (stage === "rejected") { setRejectFor(c); setRejectReason(""); return; }
    move(c, stage);
  }

  function confirmReject() {
    if (!rejectFor) return;
    const c = rejectFor;
    const reason = rejectReason;
    setRejectFor(null);
    move(c, "rejected", reason);
  }

  function viewResume(c: Candidate) {
    setResumeLoading(true);
    getResumeSignedUrl(c.id)
      .then((res) => {
        if (!res.ok) { toast.error(res.error); return; }
        setResumeUrl(res.data!.url);
      })
      .finally(() => setResumeLoading(false));
  }

  if (candidates.length === 0) {
    return (
      <div className="rounded-lg border p-10 text-center text-sm text-muted-foreground">
        No candidates yet. Share the apply link.
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-2">
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
                    onDragStart={() => setDragId(c.id)}
                    onDragEnd={() => { setDragId(null); setOverStage(null); }}
                    className={`rounded-lg border bg-card p-3 ${isAdmin ? "cursor-grab active:cursor-grabbing" : ""} ${dragId === c.id ? "opacity-50" : ""}`}
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
                      {c.experience_years != null && <div>{c.experience_years} yr experience</div>}
                      {c.expected_salary != null && <div>Expected {formatRp(c.expected_salary)}</div>}
                      {(c.height_cm != null || c.weight_kg != null) && (
                        <div>
                          {c.height_cm != null ? `${c.height_cm} cm` : ""}
                          {c.height_cm != null && c.weight_kg != null ? " · " : ""}
                          {c.weight_kg != null ? `${c.weight_kg} kg` : ""}
                        </div>
                      )}
                    </div>

                    {c.cover_note && <p className="mt-2 line-clamp-3 text-sm">{c.cover_note}</p>}
                    {c.stage === "rejected" && c.reject_reason && (
                      <p className="mt-2 text-sm text-muted-foreground"><span className="font-medium">Reason:</span> {c.reject_reason}</p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <a href={waLink(c.whatsapp)} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm hover:bg-muted">
                        <MessageCircle className="size-4" /> WA
                      </a>
                      {c.resume_path && (
                        <button type="button" disabled={resumeLoading} onClick={() => viewResume(c)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm hover:bg-muted disabled:opacity-50">
                          <FileText className="size-4" /> {resumeLoading ? "…" : "Resume"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {list.length === 0 && <div className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">—</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Résumé PDF viewer */}
      <Dialog open={!!resumeUrl} onOpenChange={(o) => !o && setResumeUrl(null)}>
        <DialogContent className="h-[85vh] w-[95vw] max-w-4xl p-0 gap-0">
          <DialogHeader className="px-4 py-3">
            <DialogTitle>Résumé</DialogTitle>
          </DialogHeader>
          {resumeUrl && <iframe src={resumeUrl} className="h-full w-full rounded-b-lg" title="Résumé" />}
        </DialogContent>
      </Dialog>

      {/* Reject reason (optional) */}
      <Dialog open={!!rejectFor} onOpenChange={(o) => !o && setRejectFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejectFor?.name}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <label htmlFor="reject-reason" className="text-sm text-muted-foreground">Reason (optional)</label>
            <Textarea id="reject-reason" rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
            <Button disabled={pending} onClick={confirmReject}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
