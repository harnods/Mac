"use client";

import { useState } from "react";
import { CrewAttendancePanel } from "@/components/employees/crew-attendance-panel";
import { CrewPayslipPanel } from "@/components/employees/crew-payslip-panel";
import type { Payslip, PayslipLine, PayrollRun } from "@/lib/supabase/types";

type PayslipWithDetail = Payslip & { run: PayrollRun; lines: PayslipLine[] };

type Tab = "profile" | "attendance" | "overtime" | "time-off" | "payroll";

const TABS: { key: Tab; label: string }[] = [
  { key: "profile", label: "Crew profile" },
  { key: "attendance", label: "Attendance" },
  { key: "overtime", label: "Overtime" },
  { key: "time-off", label: "Time off" },
  { key: "payroll", label: "Payroll" },
];

export function EmployeeDetailTabs({
  children,
  employeeId,
  joinDate = null,
  stopDate = null,
  cutoffStartDay,
  cutoffEndDay,
  lateGraceMinutes,
  lateToleranceDirection,
  earlyLeaveGraceMinutes,
  today,
  shifts = [],
  canWrite = false,
  payslips = [],
}: {
  children: React.ReactNode;
  employeeId: string;
  joinDate?: string | null;
  stopDate?: string | null;
  cutoffStartDay: number;
  cutoffEndDay: number;
  lateGraceMinutes: number;
  lateToleranceDirection: "before" | "after";
  earlyLeaveGraceMinutes: number;
  today: string;
  shifts?: { id: string; name: string; start_time: string | null; end_time: string | null }[];
  canWrite?: boolean;
  payslips?: PayslipWithDetail[];
}) {
  const [tab, setTab] = useState<Tab>("profile");
  const active = TABS.find((t) => t.key === tab)!;

  return (
    <div className="space-y-8">
      <div className="border-b">
        <div className="flex items-center gap-1 -ml-3">
          {TABS.map((t) => (
            <TabButton key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label}
            </TabButton>
          ))}
        </div>
      </div>

      {tab === "profile" ? (
        children
      ) : tab === "attendance" ? (
        <CrewAttendancePanel
          employeeId={employeeId}
          joinDate={joinDate}
          stopDate={stopDate}
          cutoffStartDay={cutoffStartDay}
          cutoffEndDay={cutoffEndDay}
          lateGraceMinutes={lateGraceMinutes}
          lateToleranceDirection={lateToleranceDirection}
          earlyLeaveGraceMinutes={earlyLeaveGraceMinutes}
          today={today}
          shifts={shifts}
          canWrite={canWrite}
        />
      ) : tab === "payroll" ? (
        <CrewPayslipPanel payslips={payslips} />
      ) : (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No {active.label.toLowerCase()} records yet.
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
