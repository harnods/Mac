"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { HIRING_STAGE_LABEL as STAGE_LABEL, type HiringStage } from "@/lib/recruitment";
import { setCandidateStage, hireCandidate, type HireComponent } from "@/app/actions/recruitment";

type CompRow = { checked: boolean; amount: string; rate_unit: "day" | "week" | "month" };
export type StageTarget = { id: string; name: string; stage: HiringStage };

/** Stage changes shared by the pipeline board and the candidate detail page.
 *  Rejected asks for an optional reason, Hired asks for salary + payroll
 *  components; every other stage moves straight away. Render `dialogs`. */
export function useStageMove(hireComponents: HireComponent[]) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rejectFor, setRejectFor] = useState<StageTarget | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [hireFor, setHireFor] = useState<StageTarget | null>(null);
  const [basicSalary, setBasicSalary] = useState("");
  const [comp, setComp] = useState<Record<string, CompRow>>({});

  function move(c: StageTarget, stage: HiringStage, reason?: string) {
    if (stage === c.stage && stage !== "rejected") return;
    start(async () => {
      const res = await setCandidateStage(c.id, stage, reason);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`Moved to ${STAGE_LABEL[stage]}`);
      router.refresh();
    });
  }

  function requestMove(c: StageTarget, stage: HiringStage) {
    if (stage === c.stage) return;
    if (stage === "rejected") { setRejectFor(c); setRejectReason(""); return; }
    if (stage === "hired") {
      setHireFor(c); setBasicSalary("");
      setComp(Object.fromEntries(hireComponents.map((h) => [h.id, { checked: false, amount: "", rate_unit: "month" as const }])));
      return;
    }
    move(c, stage);
  }

  function confirmReject() {
    if (!rejectFor) return;
    const c = rejectFor;
    const reason = rejectReason;
    setRejectFor(null);
    move(c, "rejected", reason);
  }

  function confirmHire() {
    if (!hireFor) return;
    const c = hireFor;
    const allowances = hireComponents
      .filter((h) => comp[h.id]?.checked)
      .map((h) => ({
        allowance_id: h.id,
        amount: h.isFormula ? 0 : Number((comp[h.id]?.amount ?? "").replace(/[^0-9]/g, "")) || 0,
        rate_unit: comp[h.id]?.rate_unit ?? "month",
        per_attendance: false,
      }));
    const basic = basicSalary ? Number(basicSalary.replace(/[^0-9]/g, "")) : null;
    setHireFor(null);
    start(async () => {
      const res = await hireCandidate(c.id, { basicSalary: basic, allowances });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${c.name} hired — added to crew`);
      router.refresh();
    });
  }

  const dialogs = (
    <>
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

      {/* Hire — set basic salary + payroll components, then create crew */}
      <Dialog open={!!hireFor} onOpenChange={(o) => !o && setHireFor(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Hire {hireFor?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="hire-salary">Basic salary (Rp)</Label>
              <Input
                id="hire-salary"
                inputMode="numeric"
                value={basicSalary}
                onChange={(e) => { const d = e.target.value.replace(/[^0-9]/g, ""); setBasicSalary(d ? Number(d).toLocaleString("id-ID") : ""); }}
              />
            </div>

            <div className="space-y-2">
              <Label>Payroll components</Label>
              {hireComponents.length === 0 && <p className="text-sm text-muted-foreground">No components defined.</p>}
              <div className="space-y-2">
                {hireComponents.map((h) => {
                  const row = comp[h.id] ?? { checked: false, amount: "", rate_unit: "month" as const };
                  return (
                    <div key={h.id} className="rounded-lg border p-2.5">
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={row.checked}
                          onChange={(e) => setComp((s) => ({ ...s, [h.id]: { ...row, checked: e.target.checked } }))}
                        />
                        <span className="font-medium">{h.name}</span>
                        <span className="text-xs text-muted-foreground">{h.type === "deduction" ? "Deduction" : "Earning"}{h.isFormula ? " · formula" : ""}</span>
                      </label>
                      {row.checked && !h.isFormula && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="relative flex-1">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
                            <Input inputMode="numeric" className="h-9 pl-9" value={row.amount}
                              onChange={(e) => { const d = e.target.value.replace(/[^0-9]/g, ""); setComp((s) => ({ ...s, [h.id]: { ...row, amount: d ? Number(d).toLocaleString("id-ID") : "" } })); }} />
                          </div>
                          <Select value={row.rate_unit} onValueChange={(v) => setComp((s) => ({ ...s, [h.id]: { ...row, rate_unit: v as CompRow["rate_unit"] } }))}>
                            <SelectTrigger className="h-9 w-28 shrink-0"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="day">per day</SelectItem>
                              <SelectItem value="week">per week</SelectItem>
                              <SelectItem value="month">per month</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {row.checked && h.isFormula && <p className="mt-1 pl-6 text-xs text-muted-foreground">Auto — computed by formula at payroll run.</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
            <Button disabled={pending} onClick={confirmHire}>Hire &amp; add to crew</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  return { requestMove, pending, dialogs };
}
