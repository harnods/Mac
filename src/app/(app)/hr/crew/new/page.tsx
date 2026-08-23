import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { EmployeeForm } from "@/components/employees/employee-form";
import { getEmployeeFormData } from "@/app/actions/employees";

export const dynamic = "force-dynamic";

export default async function NewEmployeePage() {
  const formData = await getEmployeeFormData();
  if (!formData) redirect("/hr/crew");

  return (
    <div className="flex flex-col flex-1 gap-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2">
          <Link href="/hr/crew"><ArrowLeft className="size-4" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">New crew</h1>
      </div>

      <EmployeeForm
        departments={formData.departments}
        jobPositions={formData.jobPositions}
        employmentStatuses={formData.employmentStatuses}
        jobLevels={formData.jobLevels}
        allowances={formData.allowances}
        formulaComponentIds={formData.formulaComponentIds}
      />
    </div>
  );
}
