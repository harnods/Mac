"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { formatDate } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type ReportRow = {
  employeeId: string;
  name: string;
  department: string | null;
  workingDays: number;
  present: number;
  dayOff: number;
  absent: number;
  late: number;
  earlyLeave: number;
  workedHours: number;
  overtimeHours: number;
  rate: number; // 0..1
  joinedDate: string | null; // set when the crew joined mid-period (prorated)
};

const ALL = "__all__";

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function AttendanceReportView({
  rows,
  departments,
  monthOptions,
  ym,
  periodLabel,
}: {
  rows: ReportRow[];
  departments: { id: string; name: string }[];
  monthOptions: { key: string; label: string }[];
  ym: string;
  periodLabel: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [dept, setDept] = useState(ALL);
  const [search, setSearch] = useState("");

  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          (dept === ALL || r.department === departments.find((d) => d.id === dept)?.name) &&
          r.name.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [rows, dept, search, departments],
  );

  const totals = useMemo(() => {
    const present = shown.reduce((s, r) => s + r.present, 0);
    const working = shown.reduce((s, r) => s + r.workingDays, 0);
    return {
      crew: shown.length,
      present,
      absent: shown.reduce((s, r) => s + r.absent, 0),
      late: shown.reduce((s, r) => s + r.late, 0),
      overtime: shown.reduce((s, r) => s + r.overtimeHours, 0),
      rate: working > 0 ? present / working : 0,
    };
  }, [shown]);

  function onMonth(next: string) {
    const sp = new URLSearchParams(params.toString());
    sp.set("ym", next);
    router.replace(`?${sp.toString()}`, { scroll: false });
  }

  function exportCsv() {
    const header = ["Crew", "Department", "Working days", "Present", "Day off", "Absent", "Late", "Early leave", "Worked hours", "Overtime hours", "Attendance rate"];
    const lines = shown.map((r) => [
      r.name,
      r.department ?? "",
      r.workingDays,
      r.present,
      r.dayOff,
      r.absent,
      r.late,
      r.earlyLeave,
      r.workedHours,
      r.overtimeHours,
      `${Math.round(r.rate * 100)}%`,
    ]);
    const csv = [header, ...lines]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-report-${ym}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <TooltipProvider>
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={ym} onValueChange={onMonth}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{monthOptions.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          {departments.length > 0 && (
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All departments" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All departments</SelectItem>
                {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Search crew..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-56" />
          <Button variant="outline" onClick={exportCsv}><Download className="size-4" /> Export</Button>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">Period <span className="text-foreground">{periodLabel}</span></div>

      <div className="grid max-w-lg grid-cols-2 gap-3">
        <StatCard label="Crew in report" value={String(totals.crew)} />
        <StatCard
          label="Attendance rate"
          value={`${Math.round(totals.rate * 100)}%`}
          hint="Working days actually clocked in ÷ total working days, across all crew"
        />
      </div>

      <div className="border table-outer rounded-lg overflow-x-auto">
        <Table className="w-auto min-w-full table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Crew</TableHead>
              <TableHead className="w-[150px]">Department</TableHead>
              <TableHead className="w-[100px]">Present</TableHead>
              <TableHead className="w-[90px]">Day off</TableHead>
              <TableHead className="w-[90px]">Absent</TableHead>
              <TableHead className="w-[80px]">Late</TableHead>
              <TableHead className="w-[110px]">Early leave</TableHead>
              <TableHead className="w-[110px]">Worked</TableHead>
              <TableHead className="w-[110px]">Overtime</TableHead>
              <TableHead className="w-[110px]">Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">No crew match.</TableCell>
              </TableRow>
            )}
            {shown.map((r) => (
              <TableRow key={r.employeeId}>
                <TableCell className="font-medium truncate">{r.name}</TableCell>
                <TableCell className="text-sm">{r.department ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-sm tabular-nums">{r.present}/{r.workingDays}</TableCell>
                <TableCell className="text-sm tabular-nums">{r.dayOff || "—"}</TableCell>
                <TableCell className="text-sm tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    {r.absent || "—"}
                    {r.joinedDate && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="size-3.5 cursor-help text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>Joined {formatDate(r.joinedDate)} — days before aren&rsquo;t counted as absent.</TooltipContent>
                      </Tooltip>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-sm tabular-nums">{r.late || "—"}</TableCell>
                <TableCell className="text-sm tabular-nums">{r.earlyLeave || "—"}</TableCell>
                <TableCell className="text-sm tabular-nums">{r.workedHours}h</TableCell>
                <TableCell className="text-sm tabular-nums">{r.overtimeHours ? `${r.overtimeHours}h` : "—"}</TableCell>
                <TableCell className="text-sm tabular-nums">{Math.round(r.rate * 100)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
    </TooltipProvider>
  );
}
