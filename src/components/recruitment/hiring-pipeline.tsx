"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, MessageCircle, MoveRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const [resumePending, setResumePending] = useState<string | null>(null);

  function move(c: Candidate, stage: HiringStage) {
    if (stage === c.stage) return;
    start(async () => {
      const res = await setCandidateStage(c.id, stage);
      if (!res.ok) { toast.error(res.error); return; }
      router.refresh();
    });
  }

  function viewResume(c: Candidate) {
    setResumePending(c.id);
    getResumeSignedUrl(c.id)
      .then((res) => {
        if (!res.ok) { toast.error(res.error); return; }
        window.open(res.data!.url, "_blank", "noopener");
      })
      .finally(() => setResumePending(null));
  }

  if (candidates.length === 0) {
    return (
      <div className="rounded-lg border p-10 text-center text-sm text-muted-foreground">
        No candidates yet. Share the apply link.
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {HIRING_STAGES.map((stage) => {
        const list = candidates.filter((c) => c.stage === stage);
        return (
          <div key={stage} className="w-72 shrink-0 space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-sm font-semibold">{STAGE_LABEL[stage]}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{list.length}</span>
            </div>
            <div className="space-y-2">
              {list.map((c) => (
                <div key={c.id} className="rounded-lg border bg-card p-3 text-sm">
                  <div className="font-medium">{c.name}</div>
                  <div className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
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
                  {c.cover_note && <p className="mt-2 line-clamp-3 text-xs">{c.cover_note}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <a
                      href={waLink(c.whatsapp)}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
                    >
                      <MessageCircle className="size-3.5" /> WA
                    </a>
                    {c.resume_path && (
                      <button
                        type="button"
                        disabled={resumePending === c.id}
                        onClick={() => viewResume(c)}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                      >
                        <FileText className="size-3.5" /> {resumePending === c.id ? "…" : "Resume"}
                      </button>
                    )}
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" disabled={pending}>
                            <MoveRight className="size-3.5" /> Move
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {HIRING_STAGES.filter((s) => s !== c.stage).map((s) => (
                            <DropdownMenuItem key={s} onSelect={() => move(c, s)}>{STAGE_LABEL[s]}</DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
              {list.length === 0 && <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">—</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
