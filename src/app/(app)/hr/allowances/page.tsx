import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { AllowancesManager, type ComponentRow } from "@/components/employees/allowances-manager";
import { AddPayrollComponentButton } from "@/components/employees/add-payroll-component-button";
import type { Allowance, PayrollComponentVersion } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function PayrollComponentsPage() {
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.EMPLOYEES_WRITE);
  const supabase = await createClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

  const [{ data: comps }, { data: vers }] = await Promise.all([
    supabase.from("allowances").select("id,name,type,is_default,updated_by,updated_at").order("is_default", { ascending: false }).order("name"),
    supabase.from("payroll_component_versions").select("id,component_id,effective_date,amount,rate_unit,formula_basis,formula_rate,created_by,created_at").order("effective_date", { ascending: true }),
  ]);

  const components = (comps ?? []) as Allowance[];
  const versions = (vers ?? []) as PayrollComponentVersion[];
  const items: ComponentRow[] = components.map((component) => ({
    component,
    versions: versions.filter((v) => v.component_id === component.id),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Payroll components</h1>
        {isAdmin && <AddPayrollComponentButton today={today} />}
      </div>

      <AllowancesManager items={items} isAdmin={isAdmin} today={today} />
    </div>
  );
}
