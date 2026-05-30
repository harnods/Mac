import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { EmployeeForm } from "@/components/employees/employee-form";
import { getEmployeeFormData } from "@/app/actions/employees";

export const dynamic = "force-dynamic";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const formData = await getEmployeeFormData(id);

  if (!formData || !formData.employee) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2">
          <Link href={`/employees/${id}`}><ArrowLeft className="size-4" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit {formData.employee.name}
        </h1>
      </div>

      <EmployeeForm
        departments={formData.departments}
        jobPositions={formData.jobPositions}
        employmentStatuses={formData.employmentStatuses}
        jobLevels={formData.jobLevels}
        employee={formData.employee}
      />
    </div>
  );
}
