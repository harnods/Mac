import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { getPayrollComponent } from "@/app/actions/employees";
import { activeVersion } from "@/lib/payroll-component";
import { DetailBackButton } from "@/components/employees/detail-back-button";
import { PayrollComponentDetail } from "@/components/employees/payroll-component-detail";
import { EditPayrollComponentButton } from "@/components/employees/edit-payroll-component-button";

export const dynamic = "force-dynamic";

export default async function PayrollComponentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.EMPLOYEES_WRITE);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

  const { component, versions } = await getPayrollComponent(id);
  if (!component) notFound();

  const current = activeVersion(versions, today);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <DetailBackButton href="/hr/allowances" />
          <h1 className="text-2xl font-semibold tracking-tight">{component.name}</h1>
        </div>
        {isAdmin && (
          <EditPayrollComponentButton
            today={today}
            prefill={{
              id: component.id,
              name: component.name,
              type: component.type,
              effective_date: current?.effective_date ?? today,
            }}
          />
        )}
      </div>

      <PayrollComponentDetail component={component} versions={versions} today={today} />
    </div>
  );
}
