"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { settingsHistory, activeSettingsVersion, ordinal } from "@/lib/payroll-settings";
import { formatDate } from "@/lib/format";
import type { PayrollSettingsVersion } from "@/lib/supabase/types";

type Tab = "details" | "history";

function DetailRow({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm sm:col-span-2">
        {value ?? "—"}
        {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
      </dd>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
        active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function PayrollSettingsDetail({
  versions,
  today,
}: {
  versions: PayrollSettingsVersion[];
  today: string;
}) {
  const [tab, setTab] = useState<Tab>("details");

  const current = activeSettingsVersion(versions, today);
  const history = settingsHistory(versions, today);

  return (
    <div className="space-y-6">
      <div className="border-b">
        <div className="-ml-3 flex items-center gap-1">
          <TabButton active={tab === "details"} onClick={() => setTab("details")}>Payroll settings details</TabButton>
          <TabButton active={tab === "history"} onClick={() => setTab("history")}>History</TabButton>
        </div>
      </div>

      {tab === "details" ? (
        <dl className="max-w-2xl">
          <DetailRow
            label="Payroll cutoff"
            value={current ? `${ordinal(current.cutoff_start_day)} – ${ordinal(current.cutoff_end_day)}` : "—"}
            hint={current ? `Each period runs from the ${ordinal(current.cutoff_start_day)} to the ${ordinal(current.cutoff_end_day)} of the next month.` : undefined}
          />
          <DetailRow
            label="Payday"
            value={current ? `${ordinal(current.payday)} of every month` : "—"}
            hint="When salaries are paid out. If a month has fewer days, it falls on the last day."
          />
          <DetailRow
            label="Absence deduction"
            value={current ? (current.deduct_absence_from_salary ? "On" : "Off") : "—"}
            hint={
              current
                ? current.deduct_absence_from_salary
                  ? "Days absent (not a Day off) — permit, sick, or no-show — are deducted from basic salary: basic salary ÷ working days in the period × days absent."
                  : "Absent days are not deducted from basic salary."
                : undefined
            }
          />
          <DetailRow label="Effective date" value={current ? formatDate(current.effective_date) : "—"} />
        </dl>
      ) : (
        <div className="border table-outer rounded-lg overflow-x-auto">
          <Table className="w-auto min-w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[220px]">Effective date</TableHead>
                <TableHead className="w-[130px]">Cutoff</TableHead>
                <TableHead className="w-[110px]">Payday</TableHead>
                <TableHead className="w-[150px]">Absence deduction</TableHead>
                <TableHead className="w-[110px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...history].reverse().map((row) => (
                <TableRow key={row.version.id}>
                  <TableCell className="text-sm">
                    {row.end ? `${formatDate(row.start)} – ${formatDate(row.end)}` : formatDate(row.start)}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {ordinal(row.version.cutoff_start_day)}–{ordinal(row.version.cutoff_end_day)}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">{ordinal(row.version.payday)}</TableCell>
                  <TableCell className="text-sm">{row.version.deduct_absence_from_salary ? "On" : "Off"}</TableCell>
                  <TableCell>
                    {row.active ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
