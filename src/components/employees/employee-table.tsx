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
import { EmployeeTableRow } from "@/components/employees/employee-table-row";
import type { EmployeeWithRelations } from "@/lib/supabase/types";

export const EMPLOYEE_COLUMNS: ColumnDef[] = [
  { key: "department", label: "Department" },
  { key: "jobPosition", label: "Job position" },
  { key: "jobLevel", label: "Job level" },
  { key: "status", label: "Employment status" },
  { key: "joinDate", label: "Join date" },
  { key: "lastUpdated", label: "Last updated", defaultHidden: true },
];

export function EmployeeTable({ list, canWrite }: { list: EmployeeWithRelations[]; canWrite: boolean }) {
  const { isVisible } = useColumnVisibility("employees", EMPLOYEE_COLUMNS);

  return (
    <div className="border table-outer rounded-lg overflow-x-auto">
      <Table className="w-auto min-w-full table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[240px]">Name</TableHead>
            {isVisible("department") && <TableHead className="w-[160px]">Department</TableHead>}
            {isVisible("jobPosition") && <TableHead className="w-[160px]">Job position</TableHead>}
            {isVisible("jobLevel") && <TableHead className="w-[160px]">Job level</TableHead>}
            {isVisible("status") && <TableHead className="w-[180px]">Employment status</TableHead>}
            {isVisible("joinDate") && <TableHead className="w-[160px]">Join date</TableHead>}
            {isVisible("lastUpdated") && <TableHead className="w-[160px]">Last updated</TableHead>}
            <TableHead className="p-0" />
            <TableHead className={`w-12 ${STICKY_ACTION_HEAD}`} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((emp) => (
            <EmployeeTableRow
              key={emp.id}
              employee={emp}
              canWrite={canWrite}
              showDepartment={isVisible("department")}
              showJobPosition={isVisible("jobPosition")}
              showJobLevel={isVisible("jobLevel")}
              showStatus={isVisible("status")}
              showJoinDate={isVisible("joinDate")}
              showLastUpdated={isVisible("lastUpdated")}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
