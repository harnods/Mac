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
  { key: "status", label: "Status" },
  { key: "lastUpdated", label: "Last updated", defaultHidden: true },
];

export function EmployeeTable({ list, canWrite }: { list: EmployeeWithRelations[]; canWrite: boolean }) {
  const { isVisible } = useColumnVisibility("employees", EMPLOYEE_COLUMNS);

  return (
    <div className="border table-outer rounded-lg overflow-x-auto">
      <Table className="w-full table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px]">Name</TableHead>
            {isVisible("department") && <TableHead className="min-w-[150px]">Department</TableHead>}
            {isVisible("jobPosition") && <TableHead className="min-w-[150px]">Job position</TableHead>}
            {isVisible("jobLevel") && <TableHead className="min-w-[150px]">Job level</TableHead>}
            {isVisible("status") && <TableHead className="min-w-[150px]">Status</TableHead>}
            {isVisible("lastUpdated") && <TableHead className="min-w-[150px]">Last updated</TableHead>}
            <TableHead className="w-0 p-0" />
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
              showLastUpdated={isVisible("lastUpdated")}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
