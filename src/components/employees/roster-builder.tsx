"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createRosterPattern, updateRosterPattern } from "@/app/actions/schedule";

type ShiftOpt = { id: string; name: string; start_time: string | null; end_time: string | null; active: boolean };

const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function todayISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}
function shiftLabel(s: ShiftOpt) {
  return s.start_time && s.end_time ? `${s.name} (${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)})` : s.name;
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

  const options = [...shifts]
    .filter((s) => s.active !== false)
    .sort((a, b) => a.name.localeCompare(b.name) || (a.start_time ?? "").localeCompare(b.start_time ?? ""));

  const key = (emp: string, wd: number) => `${emp}|${wd}`;
  const set = (emp: string, wd: number, val: string) => setCells((p) => ({ ...p, [key(emp, wd)]: val }));
  const fillRow = (emp: string, val: string) =>
    setCells((p) => {
      const n = { ...p };
      for (let w = 0; w < 7; w++) n[key(emp, w)] = val;
      return n;
    });

  function save() {
    if (!eff) { toast.error("Pick an effective date"); return; }
    const cellsArr: { employeeId: string; weekday: number; shiftId: string }[] = [];
    for (const c of crew) {
      for (let w = 0; w < 7; w++) {
        const v = cells[key(c.id, w)];
        if (v) cellsArr.push({ employeeId: c.id, weekday: w, shiftId: v });
      }
    }
    if (cellsArr.length === 0) { toast.error("Set at least one shift"); return; }
    start(async () => {
      const res = isEdit
        ? await updateRosterPattern(patternId!, { name, effectiveDate: eff, cells: cellsArr })
        : await createRosterPattern({ name, effectiveDate: eff, cells: cellsArr });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(isEdit ? "Shift schedule updated" : "Shift schedule created");
      router.push("/hr/schedule-patterns");
      router.refresh();
    });
  }

  const selectCls =
    "w-full rounded-md border border-input bg-background px-1.5 py-1 text-xs";

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
      </div>

      <p className="text-sm text-muted-foreground">
        Set each crew&rsquo;s weekly shifts. It repeats every week from the effective date until the next schedule. Use “Fill week” to set all seven days at once, then tweak.
      </p>

      <div className="border table-outer rounded-lg overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="sticky left-0 z-30 bg-muted border-b border-r px-3 py-2 text-left font-medium w-[180px] min-w-[180px]">Crew</th>
              <th className="border-b border-l px-2 py-2 text-center font-medium min-w-[120px]">Fill week</th>
              {WD.map((d) => (
                <th key={d} className="border-b border-l px-2 py-2 text-center font-medium min-w-[110px]">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {crew.map((c) => (
              <tr key={c.id} className="border-b last:border-b-0">
                <td className="sticky left-0 z-20 bg-background border-r px-3 py-1.5 font-medium w-[180px] min-w-[180px] max-w-[180px]">
                  <div className="max-w-[156px] truncate" title={c.name}>{c.name}</div>
                </td>
                <td className="border-l px-1.5 py-1.5">
                  <select className={selectCls} value="" onChange={(e) => { if (e.target.value !== "__keep__") fillRow(c.id, e.target.value); }}>
                    <option value="__keep__">Fill week…</option>
                    <option value="">— (clear)</option>
                    {options.map((s) => <option key={s.id} value={s.id}>{shiftLabel(s)}</option>)}
                  </select>
                </td>
                {WD.map((_, w) => (
                  <td key={w} className="border-l px-1.5 py-1.5">
                    <select className={selectCls} value={cells[key(c.id, w)] ?? ""} onChange={(e) => set(c.id, w, e.target.value)}>
                      <option value="">—</option>
                      {options.map((s) => <option key={s.id} value={s.id}>{shiftLabel(s)}</option>)}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
            {crew.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">No crew.</td></tr>
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
    </div>
  );
}
