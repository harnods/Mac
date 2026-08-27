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
import { componentHistory, activeVersion, FORMULA_BASIS_LABEL } from "@/lib/payroll-component";
import { formatDate, formatRp } from "@/lib/format";
import type { Allowance, PayrollComponentVersion } from "@/lib/supabase/types";

type Tab = "details" | "history";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm sm:col-span-2">{value ?? "—"}</dd>
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

export function PayrollComponentDetail({
  component,
  versions,
  today,
}: {
  component: Allowance;
  versions: PayrollComponentVersion[];
  today: string;
}) {
  const [tab, setTab] = useState<Tab>("details");

  const current = activeVersion(versions, today);
  const history = componentHistory(versions, today);

  return (
    <div className="space-y-6">
      <div className="border-b">
        <div className="flex items-center gap-1 -ml-3">
          <TabButton active={tab === "details"} onClick={() => setTab("details")}>Payroll component details</TabButton>
          <TabButton active={tab === "history"} onClick={() => setTab("history")}>History</TabButton>
        </div>
      </div>

      {tab === "details" ? (
        <dl className="max-w-2xl">
          <DetailRow label="Name" value={component.name} />
          <DetailRow label="Type" value={<Badge variant="secondary">{component.type === "earning" ? "Earning" : "Deduction"}</Badge>} />
          <DetailRow
            label="Formula"
            value={
              current?.formula_basis
                ? `${formatRp(current.formula_rate ?? 0)} × ${FORMULA_BASIS_LABEL[current.formula_basis]}`
                : "Fixed amount"
            }
          />
          <DetailRow label="Effective date" value={current ? formatDate(current.effective_date) : "—"} />
        </dl>
      ) : (
        <div className="border table-outer rounded-lg overflow-x-auto">
          <Table className="w-auto min-w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[260px]">Effective date</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...history].reverse().map((row) => (
                <TableRow key={row.version.id}>
                  <TableCell className="text-sm">
                    {row.end ? `${formatDate(row.start)} – ${formatDate(row.end)}` : formatDate(row.start)}
                  </TableCell>
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
