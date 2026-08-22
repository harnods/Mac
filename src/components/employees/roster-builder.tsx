"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createRosterPattern, updateRosterPattern } from "@/app/actions/schedule";
import { createShift } from "@/app/actions/shifts";

type ShiftOpt = { id: string; name: string; start_time: string | null; end_time: string | null; active: boolean };

const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function todayISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}
function shiftLabel(s: ShiftOpt) {
  return s.start_time && s.end_time ? `${s.name} (${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)})` : s.name;
}

/** Shift name on line 1 (truncated), hours on line 2 (always reserved so every
 *  cell is the same height). */
function twoLine(s: ShiftOpt) {
  return (
    <span className="flex min-w-0 flex-col leading-tight">
      <span className="truncate">{s.name}</span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {s.start_time && s.end_time ? `${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}` : " "}
      </span>
    </span>
  );
}

export function RosterBuilder({
  crew,
  shifts,
  patternId,
  initialName = "",
  initialEffective,
  initialCells,
}: {
  crew: { id: string; name: string }[];
  shifts: ShiftOpt[];
  patternId?: string;
  initialName?: string;
  initialEffective?: string;
  initialCells?: Record<string, string>;
}) {
  const router = useRouter();
  const isEdit = !!patternId;
  const [name, setName] = useState(initialName);
  const [eff, setEff] = useState(initialEffective ?? todayISO());
  const [cells, setCells] = useState<Record<string, string>>(initialCells ?? {});
  const [pending, start] = useTransition();
  const [scopeOpen, setScopeOpen] = useState(false);
  const [scope, setScope] = useState<"effective" | "from">("effective");
  const [applyFrom, setApplyFrom] = useState(todayISO());

  // Locally-extendable shift list so quick-added shifts appear immediately.
  const [shiftList, setShiftList] = useState<ShiftOpt[]>(shifts);
  const [addOpen, setAddOpen] = useState(false);
  const [aName, setAName] = useState("");
  const [aStart, setAStart] = useState("");
  const [aEnd, setAEnd] = useState("");
  const [aBreak, setABreak] = useState("0");

  function addShift() {
    if (!aName.trim()) { toast.error("Shift name is required"); return; }
    if (!aStart || !aEnd) { toast.error("Start and end time are required"); return; }
    start(async () => {
      const res = await createShift(
        { name: aName.trim(), start_time: aStart, end_time: aEnd, break_minutes: Number(aBreak) || 0 },
        { revalidate: false },
      );
      if (!res.ok) { toast.error(res.error); return; }
      setShiftList((prev) => [
        ...prev,
        { id: res.id!, name: aName.trim(), start_time: aStart, end_time: aEnd, active: true },
      ]);
      toast.success("Shift created");
      setAddOpen(false);
      setAName(""); setAStart(""); setAEnd(""); setABreak("0");
    });
  }

  // No-time defaults (Day off / No schedule / Unpaid) first, then the rest.
  const options = [...shiftList]
    .filter((s) => s.active !== false)
    .sort(
      (a, b) =>
        (a.start_time ? 1 : 0) - (b.start_time ? 1 : 0) ||
        a.name.localeCompare(b.name) ||
        (a.start_time ?? "").localeCompare(b.start_time ?? ""),
    );

  const key = (emp: string, wd: number) => `${emp}|${wd}`;
  const set = (emp: string, wd: number, val: string) => setCells((p) => ({ ...p, [key(emp, wd)]: val }));

  function collectCells() {
    const arr: { employeeId: string; weekday: number; shiftId: string }[] = [];
    for (const c of crew) {
      for (let w = 0; w < 7; w++) {
        const v = cells[key(c.id, w)];
        if (v) arr.push({ employeeId: c.id, weekday: w, shiftId: v });
      }
    }
    return arr;
  }

  function save() {
    if (!eff) { toast.error("Pick an effective date"); return; }
    if (collectCells().length === 0) { toast.error("Set at least one shift"); return; }
    // Editing an existing pattern: ask how the change should apply.
    if (isEdit) { setScope("effective"); setApplyFrom(todayISO()); setScopeOpen(true); return; }
    start(async () => {
      const res = await createRosterPattern({ name, effectiveDate: eff, cells: collectCells() });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Shift schedule created");
      router.push("/hr/schedule-patterns");
      router.refresh();
    });
  }

  function saveEdit() {
    const cellsArr = collectCells();
    start(async () => {
      const res =
        scope === "from"
          ? await createRosterPattern({ name, effectiveDate: applyFrom, cells: cellsArr })
          : await updateRosterPattern(patternId!, { name, effectiveDate: eff, cells: cellsArr });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(scope === "from" ? "New schedule created from that date" : "Shift schedule updated");
      setScopeOpen(false);
      router.push("/hr/schedule-patterns");
      router.refresh();
    });
  }


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="eff">Effective date</Label>
          <Input id="eff" type="date" value={eff} onChange={(e) => setEff(e.target.value)} className="w-44" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pname">Name (optional)</Label>
          <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. August roster" className="w-64" />
        </div>
        <div className="ml-auto">
          <Button variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" /> New shift
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Set each crew&rsquo;s weekly shifts. It repeats every week from the effective date until the next schedule.
      </p>

      <div className="border table-outer rounded-lg overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="sticky left-0 z-30 bg-muted border-b border-r px-3 py-2 text-left font-medium w-[180px] min-w-[180px]">Crew</th>
              {WD.map((d) => (
                <th key={d} className="border-b border-l px-2 py-2 text-center font-medium min-w-[150px] w-[150px]">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {crew.map((c) => (
              <tr key={c.id} className="border-b last:border-b-0">
                <td className="sticky left-0 z-20 bg-background border-r px-3 py-1.5 font-medium w-[180px] min-w-[180px] max-w-[180px]">
                  <div className="max-w-[156px] truncate" title={c.name}>{c.name}</div>
                </td>
                {WD.map((_, w) => {
                  const sel = options.find((s) => s.id === cells[key(c.id, w)]);
                  return (
                    <td key={w} className="border-l px-1.5 py-1.5">
                      <Select
                        value={cells[key(c.id, w)] || "__none__"}
                        onValueChange={(v) => set(c.id, w, v === "__none__" ? "" : v)}
                      >
                        <SelectTrigger
                          className="!h-[52px] w-full items-center py-1.5 text-left"
                          title={sel ? shiftLabel(sel) : undefined}
                        >
                          {sel ? twoLine(sel) : <span className="text-muted-foreground">—</span>}
                        </SelectTrigger>
                        <SelectContent position="popper" align="start" className="min-w-[220px]">
                          <SelectItem value="__none__">—</SelectItem>
                          {options.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{twoLine(s)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  );
                })}
              </tr>
            ))}
            {crew.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">No crew.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.push(isEdit ? "/hr/schedule-patterns" : "/hr/schedule")}>Cancel</Button>
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create schedule"}
        </Button>
      </div>

      <Dialog open={addOpen} onOpenChange={(o) => !o && setAddOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New shift</DialogTitle>
            <DialogDescription>Create a shift without leaving the schedule. It becomes available in the pickers immediately.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="a-name">Shift name</Label>
              <Input id="a-name" value={aName} onChange={(e) => setAName(e.target.value)} placeholder="e.g. Bar - Shift 1" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="a-start">Start time</Label>
                <Input id="a-start" type="time" value={aStart} onChange={(e) => setAStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="a-end">End time</Label>
                <Input id="a-end" type="time" value={aEnd} onChange={(e) => setAEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-break">Break (minutes)</Label>
              <Input id="a-break" type="number" min="0" step="5" value={aBreak} onChange={(e) => setABreak(e.target.value)} className="w-40" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
            <Button onClick={addShift} disabled={pending}>{pending ? "Saving…" : "Add shift"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scopeOpen} onOpenChange={(o) => !o && setScopeOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Apply these changes</DialogTitle>
            <DialogDescription>Choose from when this edit should take effect.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer">
              <input type="radio" className="mt-1" name="scope" checked={scope === "effective"} onChange={() => setScope("effective")} />
              <span>
                <span className="text-sm font-medium">Whole schedule (from {eff})</span>
                <span className="block text-xs text-muted-foreground">Rewrites this pattern from its effective date.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer">
              <input type="radio" className="mt-1" name="scope" checked={scope === "from"} onChange={() => setScope("from")} />
              <span className="flex-1">
                <span className="text-sm font-medium">From a specific date onward</span>
                <span className="block text-xs text-muted-foreground">Keeps earlier days unchanged; starts a new version from this date.</span>
                {scope === "from" && (
                  <Input type="date" value={applyFrom} min={eff} onChange={(e) => setApplyFrom(e.target.value)} className="mt-2 w-44" />
                )}
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setScopeOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={pending}>{pending ? "Saving…" : "Apply"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
