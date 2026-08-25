import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";
import { DetailBackButton } from "@/components/employees/detail-back-button";
import { formatDate, formatDateTime, formatRp, updaterName, yearsSince, durationSince } from "@/lib/format";
import { EmployeeDetailActions } from "@/components/employees/employee-detail-actions";
import { CrewLoginButton } from "@/components/employees/crew-login-button";
import { CompensationSection } from "@/components/employees/compensation-section";
import { EmployeeDetailTabs } from "@/components/employees/employee-detail-tabs";
import { CrewSwitcher } from "@/components/employees/crew-switcher";
import { getPayrollSettings } from "@/app/actions/payroll";
import { getAttendanceSettings } from "@/app/actions/attendance";
import { getCrewPayslips } from "@/app/actions/payroll-run";
import type { EmployeeWithRelations } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const GENDER_LABEL: Record<string, string> = {
  male: "Male",
  female: "Female",
};

const COMP_DOTS = <span className="tracking-widest text-muted-foreground">••••••</span>;

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm sm:col-span-2">{value || "—"}</dd>
    </div>
  );
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const isAdmin = can(profile, P.EMPLOYEES_WRITE);
  // Compensation is sensitive: only the account owner (super admin), or a role
  // explicitly granted the permission, may see the real figures. Others get dots.
  const canViewCompensation = !!profile?.is_owner || can(profile, P.EMPLOYEES_COMPENSATION);
  const [payroll, attendanceSettings] = await Promise.all([getPayrollSettings(), getAttendanceSettings()]);
  const cutoffStartDay = payroll?.cutoff_start_day ?? 21;
  const cutoffEndDay = payroll?.cutoff_end_day ?? 20;
  const lateGraceMinutes = attendanceSettings?.late_grace_minutes ?? 0;
  const lateToleranceDirection = attendanceSettings?.late_tolerance_direction ?? "after";
  const earlyLeaveGraceMinutes = attendanceSettings?.early_leave_grace_minutes ?? 0;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

  const { data: shiftRows } = await supabase
    .from("shifts")
    .select("id,name,start_time,end_time")
    .order("start_time", { nullsFirst: true });
  const shifts = (shiftRows ?? []) as { id: string; name: string; start_time: string | null; end_time: string | null }[];

  const [{ data: allowancesData }, { data: formulaVers }] = await Promise.all([
    supabase.from("allowances").select("id,name,type"),
    supabase.from("payroll_component_versions").select("component_id").not("formula_basis", "is", null),
  ]);
  const allowanceMeta = (aid: string) =>
    (allowancesData ?? []).find((a) => a.id === aid) as { id: string; name: string; type: "earning" | "deduction" } | undefined;
  const formulaIds = new Set(((formulaVers ?? []) as { component_id: string }[]).map((v) => v.component_id));
  const UNIT_LABEL: Record<string, string> = { day: "/day", week: "/week", month: "/month" };

  const { data, error } = await supabase
    .from("employees")
    .select(
      "*, departments(id,name), job_positions(id,name), job_levels(id,name), employment_statuses(id,name), updater:profiles!updated_by(full_name,email), mac_user:profiles!user_id(id,email,role,is_owner)"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) notFound();
  const emp = data as EmployeeWithRelations;
  const isResigned = !!emp.termination_date;
  const salaryUnit = emp.salary_unit === "day" ? "per day" : "per month";
  const payslips = canViewCompensation ? await getCrewPayslips(id) : [];

  // Crew list for the title switcher (owner excluded). Default view shows active;
  // searching in the dropdown spans inactive/resigned too.
  const { data: ownerRow } = await supabase.from("profiles").select("id").eq("is_owner", true).maybeSingle();
  let switcherQ = supabase
    .from("employees")
    .select("id,name,active,termination_date,last_day")
    .is("deleted_at", null)
    .order("name");
  if (ownerRow?.id) switcherQ = switcherQ.or(`user_id.is.null,user_id.neq.${ownerRow.id}`);
  const { data: switcherData } = await switcherQ;
  const crewOptions = ((switcherData ?? []) as { id: string; name: string; active: boolean | null; termination_date: string | null; last_day: string | null }[]).map((c) => ({
    id: c.id,
    name: c.name,
    status: (c.termination_date || c.last_day ? "resigned" : c.active === false ? "inactive" : "active") as "active" | "inactive" | "resigned",
  }));
  const { data: overtimeData } = await supabase
    .from("overtime_requests")
    .select("id,work_date,clock_in,clock_out,break_minutes,hours,reason_in,reason_out,reason,status")
    .eq("employee_id", id)
    .order("work_date", { ascending: false });
  const overtime = (overtimeData ?? []).map((o) => ({ ...o, hours: Number(o.hours) || 0 })) as {
    id: string; work_date: string; clock_in: string | null; clock_out: string | null;
    break_minutes: number; hours: number; reason_in: string | null; reason_out: string | null;
    reason: string | null; status: "pending" | "approved" | "rejected";
  }[];
  const initials = emp.name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-8">
      {/* Title — full width (12 columns, to the far right) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <DetailBackButton href="/hr/crew" />
          <CrewSwitcher currentId={id} name={emp.name} crew={crewOptions} />
          {isResigned && <Badge variant="secondary">Resigned</Badge>}
          {!isResigned && !emp.active && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Inactive</Badge>
          )}
        </div>
        {isAdmin && (
          <EmployeeDetailActions
            id={id}
            name={emp.name}
            canDelete={!emp.mac_user?.is_owner}
            active={emp.active}
            terminationDate={emp.termination_date}
            lastDay={emp.last_day}
          />
        )}
      </div>

      {/* Tabs — Crew profile holds the detail content; other modules TBD */}
      <EmployeeDetailTabs
        employeeId={id}
        joinDate={emp.join_date}
        stopDate={[emp.inactive_date, emp.last_day, emp.termination_date].filter(Boolean).sort()[0] ?? null}
        cutoffStartDay={cutoffStartDay}
        cutoffEndDay={cutoffEndDay}
        lateGraceMinutes={lateGraceMinutes}
        lateToleranceDirection={lateToleranceDirection}
        earlyLeaveGraceMinutes={earlyLeaveGraceMinutes}
        today={today}
        shifts={shifts}
        canWrite={isAdmin}
        payslips={payslips}
        overtime={overtime}
      >
      {/* Body — 12 columns: info on the left (6), profile pic after it */}
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 space-y-8 lg:col-span-6">
      {/* Employee info */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Employee info</h2>
        <dl>
          <DetailRow label="Name" value={emp.name} />
          <DetailRow label="Email" value={emp.email} />
          <DetailRow
            label="WhatsApp no"
            value={emp.phone ? (
              <a
                href={`https://wa.me/${emp.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {emp.phone}
              </a>
            ) : null}
          />
          <DetailRow
            label="Birthdate"
            value={emp.birthdate ? (
              <span className="inline-flex items-center gap-2">
                {formatDate(emp.birthdate)}
                <Badge variant="secondary">{yearsSince(emp.birthdate)} years old</Badge>
              </span>
            ) : null}
          />
          <DetailRow label="NIK" value={emp.nik} />
          <DetailRow label="Gender" value={emp.gender ? GENDER_LABEL[emp.gender] : null} />
          <DetailRow label="Address" value={<span className="whitespace-pre-wrap">{emp.address}</span>} />
        </dl>
      </section>

      {/* Employment info */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Employment info</h2>
        <dl>
          <DetailRow
            label="Join date"
            value={emp.join_date ? (
              <span className="inline-flex items-center gap-2">
                {formatDate(emp.join_date)}
                <Badge variant="secondary">{durationSince(emp.join_date, emp.last_day ?? emp.termination_date)}</Badge>
              </span>
            ) : null}
          />
          {isResigned && (
            <>
              <DetailRow label="Termination date" value={emp.termination_date ? formatDate(emp.termination_date) : null} />
              <DetailRow label="Last day" value={emp.last_day ? formatDate(emp.last_day) : null} />
            </>
          )}
          <DetailRow label="Department" value={emp.departments?.name} />
          <DetailRow label="Job position" value={emp.job_positions?.name} />
          <DetailRow label="Job level" value={emp.job_levels?.name} />
          <DetailRow label="Employment status" value={emp.employment_statuses?.name} />
        </dl>
      </section>

      {/* Crew login */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Crew login</h2>
          {isAdmin && !emp.mac_user?.is_owner && (
            <CrewLoginButton employeeId={id} currentEmail={emp.mac_user?.email ?? null} />
          )}
        </div>
        <dl>
          <DetailRow label="Login email" value={emp.mac_user?.email ?? null} />
        </dl>
      </section>

      {/* Bank info */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Bank info</h2>
        <dl>
          <DetailRow label="Bank name" value={emp.bank_name} />
          <DetailRow label="Bank account number" value={emp.bank_account_no} />
          <DetailRow label="Account holder name" value={emp.account_holder_name} />
        </dl>
      </section>

      {/* Compensation — sensitive; masked behind an eye toggle, and only for authorized viewers */}
      {canViewCompensation ? (
        <CompensationSection
          basicSalary={emp.basic_salary != null ? `${formatRp(emp.basic_salary)} ${salaryUnit}` : null}
          allowances={(emp.allowances ?? []).map((a) => {
            const meta = allowanceMeta(a.allowance_id);
            const name = meta?.name ?? "Component";
            const isDeduction = meta?.type === "deduction";
            if (formulaIds.has(a.allowance_id)) {
              return { name, amount: "Auto — formula", deduction: isDeduction };
            }
            const unit = a.rate_unit ?? "month";
            const perAtt = unit === "day" && a.per_attendance ? " · per attendance" : "";
            return { name, amount: `${formatRp(a.amount)} ${UNIT_LABEL[unit] ?? "/month"}${perAtt}`, deduction: isDeduction };
          })}
        />
      ) : (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Compensation</h2>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="size-3" /> Restricted
            </span>
          </div>
          <dl>
            <DetailRow label="Basic salary" value={COMP_DOTS} />
            <DetailRow label="Payroll components" value={COMP_DOTS} />
          </dl>
        </section>
      )}

          <p className="text-xs text-muted-foreground">
            Last updated by {updaterName(emp.updater)} at {formatDateTime(emp.updated_at)}
          </p>
        </div>

        {/* Profile pic — right after the 6-column info (starts at column 7) */}
        <div className="col-span-12 lg:col-span-6 lg:col-start-7">
          <div className="flex size-[120px] items-center justify-center overflow-hidden rounded-xl border bg-muted">
            {emp.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={emp.photo_url} alt={emp.name} className="size-full object-cover" />
            ) : (
              <span className="text-3xl font-medium text-muted-foreground">{initials || "?"}</span>
            )}
          </div>
        </div>
      </div>
      </EmployeeDetailTabs>
    </div>
  );
}
