import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { EmployeeForm } from "@/components/employees/employee-form";
import { getEmployeeFormData } from "@/app/actions/employees";

export const dynamic = "force-dynamic";

export default async function NewEmployeePage() {
  const formData = await getEmployeeFormData();
  if (!formData) redirect("/employees");

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2">
          <Link href="/employees"><ArrowLeft className="size-4" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">New employee</h1>
      </div>

      <EmployeeForm
        departments={formData.departments}
        jobPositions={formData.jobPositions}
        employmentStatuses={formData.employmentStatuses}
        jobLevels={formData.jobLevels}
      />
    </div>
  );
}
