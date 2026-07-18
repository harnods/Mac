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
    <div className="border table-outer rounded-lg overflow-x-auto hidden md:block">
      <Table className="w-full">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            {isVisible("department") && <TableHead className="w-36">Department</TableHead>}
            {isVisible("jobPosition") && <TableHead className="w-40">Job position</TableHead>}
            {isVisible("jobLevel") && <TableHead className="w-32">Job level</TableHead>}
            {isVisible("status") && <TableHead className="w-36">Status</TableHead>}
            {isVisible("lastUpdated") && <TableHead className="w-44">Last updated</TableHead>}
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
