import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";
import { DetailBackButton } from "@/components/employees/detail-back-button";
import { formatDate, formatDateTime, formatRp, updaterName, yearsSince, durationSince } from "@/lib/format";
import { EmployeeDetailActions } from "@/components/employees/employee-detail-actions";
import { EmployeeDetailTabs } from "@/components/employees/employee-detail-tabs";
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

  const { data: allowancesData } = await supabase.from("allowances").select("id,name");
  const allowanceName = (aid: string) => (allowancesData ?? []).find((a) => a.id === aid)?.name ?? "Allowance";

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
          <h1 className="text-2xl font-semibold tracking-tight">{emp.name}</h1>
          {isResigned && <Badge variant="secondary">Resigned</Badge>}
        </div>
        {isAdmin && (
          <EmployeeDetailActions
            id={id}
            name={emp.name}
            canDelete={!emp.mac_user?.is_owner}
            terminationDate={emp.termination_date}
            lastDay={emp.last_day}
          />
        )}
      </div>

      {/* Tabs — Crew profile holds the detail content; other modules TBD */}
      <EmployeeDetailTabs
        employeeId={id}
        cutoffStartDay={cutoffStartDay}
        cutoffEndDay={cutoffEndDay}
        lateGraceMinutes={lateGraceMinutes}
        lateToleranceDirection={lateToleranceDirection}
        earlyLeaveGraceMinutes={earlyLeaveGraceMinutes}
        today={today}
        shifts={shifts}
        canWrite={isAdmin}
        payslips={payslips}
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

      {/* Bank info */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Bank info</h2>
        <dl>
          <DetailRow label="Bank name" value={emp.bank_name} />
          <DetailRow label="Bank account number" value={emp.bank_account_no} />
          <DetailRow label="Account holder name" value={emp.account_holder_name} />
        </dl>
      </section>

      {/* Compensation — sensitive; masked unless the viewer may see it */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Compensation</h2>
          {!canViewCompensation && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="size-3" /> Restricted
            </span>
          )}
        </div>
        {canViewCompensation ? (
          <dl>
            <DetailRow label="Basic salary" value={emp.basic_salary != null ? `${formatRp(emp.basic_salary)} ${salaryUnit}` : null} />
            <DetailRow label="Daily allowance" value={emp.daily_allowance != null ? `${formatRp(emp.daily_allowance)} per day` : null} />
            <DetailRow
              label="Allowances"
              value={emp.allowances && emp.allowances.length > 0 ? (
                <div className="space-y-1">
                  {emp.allowances.map((a, i) => (
                    <div key={i} className="flex justify-between gap-4">
                      <span>{allowanceName(a.allowance_id)}</span>
                      <span className="tabular-nums">{formatRp(a.amount)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            />
          </dl>
        ) : (
          <dl>
            <DetailRow label="Basic salary" value={COMP_DOTS} />
            <DetailRow label="Daily allowance" value={COMP_DOTS} />
            <DetailRow label="Allowances" value={COMP_DOTS} />
          </dl>
        )}
      </section>

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
