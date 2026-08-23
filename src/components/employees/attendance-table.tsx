"use client";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  STICKY_ACTION_HEAD,
} from "@/components/ui/table";
import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { AttendanceTableRow } from "@/components/employees/attendance-table-row";
import type { AttendanceFormData } from "@/app/actions/attendance";
import type { AttendanceWithRelations } from "@/lib/supabase/types";
import type { AttendanceGrace } from "@/lib/attendance";

export type OvertimeSummary = { clock_in: string | null; clock_out: string | null; break_minutes: number; hours: number };

export const ATTENDANCE_COLUMNS: ColumnDef[] = [
  { key: "date", label: "Date", defaultHidden: true },
  { key: "shift", label: "Shift" },
  { key: "clockIn", label: "Clock in" },
  { key: "clockOut", label: "Clock out" },
  { key: "breakDuration", label: "Break" },
  { key: "otClockIn", label: "Overtime clock in" },
  { key: "otClockOut", label: "Overtime clock out" },
  { key: "otBreak", label: "Overtime break" },
  { key: "duration", label: "Duration" },
  { key: "status", label: "Status" },
  { key: "note", label: "Note" },
  { key: "source", label: "Source" },
  { key: "location", label: "Location (IP / GPS)", defaultHidden: true },
  { key: "recordedBy", label: "Recorded by" },
  { key: "lastUpdated", label: "Last updated" },
];

export function AttendanceTable({ list, overtimeByEmp = {}, canWrite, formData, grace }: { list: AttendanceWithRelations[]; overtimeByEmp?: Record<string, OvertimeSummary>; canWrite: boolean; formData: AttendanceFormData; grace?: AttendanceGrace }) {
  const { isVisible } = useColumnVisibility("attendance", ATTENDANCE_COLUMNS);

  return (
    <div className="border table-outer rounded-lg overflow-x-auto">
      <Table className="w-auto min-w-full table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Crew</TableHead>
            {isVisible("date") && <TableHead className="w-[140px]">Date</TableHead>}
            {isVisible("shift") && <TableHead className="w-[120px]">Shift</TableHead>}
            {isVisible("clockIn") && <TableHead className="w-[110px]">Clock in</TableHead>}
            {isVisible("clockOut") && <TableHead className="w-[110px]">Clock out</TableHead>}
            {isVisible("breakDuration") && <TableHead className="w-[100px]">Break</TableHead>}
            {isVisible("otClockIn") && <TableHead className="w-[130px]">Overtime clock in</TableHead>}
            {isVisible("otClockOut") && <TableHead className="w-[130px]">Overtime clock out</TableHead>}
            {isVisible("otBreak") && <TableHead className="w-[120px]">Overtime break</TableHead>}
            {isVisible("duration") && <TableHead className="w-[120px]">Duration</TableHead>}
            {isVisible("status") && <TableHead className="w-[160px]">Status</TableHead>}
            {isVisible("note") && <TableHead className="w-[200px]">Note</TableHead>}
            {isVisible("source") && <TableHead className="w-[110px]">Source</TableHead>}
            {isVisible("location") && <TableHead className="w-[220px]">Location (IP / GPS)</TableHead>}
            {isVisible("recordedBy") && <TableHead className="w-[150px]">Recorded by</TableHead>}
            {isVisible("lastUpdated") && <TableHead className="w-[180px]">Last updated</TableHead>}
            <TableHead className="p-0" />
            {canWrite && <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((record) => (
            <AttendanceTableRow
              key={record.id}
              record={record}
              overtime={overtimeByEmp[record.employee_id] ?? null}
              canWrite={canWrite}
              formData={formData}
              grace={grace}
              showDate={isVisible("date")}
              showShift={isVisible("shift")}
              showClockIn={isVisible("clockIn")}
              showClockOut={isVisible("clockOut")}
              showBreak={isVisible("breakDuration")}
              showOtClockIn={isVisible("otClockIn")}
              showOtClockOut={isVisible("otClockOut")}
              showOtBreak={isVisible("otBreak")}
              showDuration={isVisible("duration")}
              showStatus={isVisible("status")}
              showNote={isVisible("note")}
              showSource={isVisible("source")}
              showLocation={isVisible("location")}
              showRecordedBy={isVisible("recordedBy")}
              showLastUpdated={isVisible("lastUpdated")}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
