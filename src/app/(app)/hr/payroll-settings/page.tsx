import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { getPayrollSettingsVersions } from "@/app/actions/payroll";
import { activeSettingsVersion } from "@/lib/payroll-settings";
import { PayrollSettingsDetail } from "@/components/employees/payroll-settings-detail";
import { EditPayrollSettingsButton } from "@/components/employees/edit-payroll-settings-button";

export const dynamic = "force-dynamic";

export default async function PayrollSettingsPage() {
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.EMPLOYEES_WRITE);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const versions = await getPayrollSettingsVersions();
  const current = activeSettingsVersion(versions, today);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
        {isAdmin && (
          <EditPayrollSettingsButton
            today={today}
            prefill={{
              effective_date: current?.effective_date ?? today,
              cutoff_start_day: current?.cutoff_start_day ?? 21,
              cutoff_end_day: current?.cutoff_end_day ?? 20,
              payday: current?.payday ?? 27,
              daily_allowance_by_attendance: current?.daily_allowance_by_attendance ?? true,
              deduct_absence_from_salary: current?.deduct_absence_from_salary ?? false,
            }}
          />
        )}
      </div>

      <PayrollSettingsDetail versions={versions} today={today} />
    </div>
  );
}
