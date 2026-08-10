import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { getMyAttendance } from "@/app/actions/crew-self";
import { getAttendanceSettings } from "@/app/actions/attendance";
import { getPayrollSettings } from "@/app/actions/payroll";
import { payrollPeriod, currentPeriodAnchor } from "@/lib/payroll";
import { formatDate } from "@/lib/format";
import { AttendanceList } from "@/components/crew/attendance-list";
import { PeriodSelect } from "@/components/crew/period-select";

export const dynamic = "force-dynamic";

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

export default async function MeAttendanceLogPage({ searchParams }: { searchParams: Promise<{ ym?: string }> }) {
  const profile = await getCurrentProfile();
  if (profile?.must_change_password) redirect("/me/change-password");

  const { ym: ymParam } = await searchParams;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

  const settings = await getPayrollSettings();
  const cutoffStart = settings?.cutoff_start_day ?? 21;
  const cutoffEnd = settings?.cutoff_end_day ?? 20;

  // End-month anchor from ?ym=YYYY-MM, else the current cutoff period.
  const [ty, tm, td] = today.split("-").map(Number);
  const def = currentPeriodAnchor(new Date(ty, tm - 1, td), cutoffStart, cutoffEnd);
  let anchorYear = def.year;
  let anchorMonth = def.month;
  if (ymParam && /^\d{4}-\d{2}$/.test(ymParam)) {
    const [y, m] = ymParam.split("-").map(Number);
    anchorYear = y;
    anchorMonth = m - 1;
  }
  const ym = `${anchorYear}-${pad(anchorMonth + 1)}`;
  const period = payrollPeriod(anchorYear, anchorMonth, cutoffStart, cutoffEnd);

  // 15 cutoff periods back through the current one.
  const options = Array.from({ length: 15 }, (_, i) => {
    const d = new Date(def.year, def.month - 14 + i, 1);
    return { key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: `${MONTH[d.getMonth()]} ${d.getFullYear()}` };
  }).reverse();

  const [records, attSettings] = await Promise.all([
    getMyAttendance(period.start, period.end),
    getAttendanceSettings(),
  ]);
  const grace = {
    lateGraceMinutes: attSettings?.late_grace_minutes ?? 0,
    lateToleranceDirection: attSettings?.late_tolerance_direction ?? ("after" as const),
    earlyLeaveGraceMinutes: attSettings?.early_leave_grace_minutes ?? 0,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/me" className="-ml-1 rounded p-1 hover:bg-muted" aria-label="Back">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">Attendance log</h1>
      </div>

      <div className="space-y-1.5">
        <PeriodSelect value={ym} options={options} />
        <p className="px-0.5 text-xs text-muted-foreground">
          {formatDate(period.start)} – {formatDate(period.end)}
        </p>
      </div>

      <AttendanceList records={records} grace={grace} />
    </div>
  );
}
