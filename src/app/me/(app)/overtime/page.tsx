import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getMyOvertime, type MyOvertime } from "@/app/actions/crew-self";
import { formatWeekdayDate } from "@/lib/format";
import { formatMinutes } from "@/lib/attendance";

export const dynamic = "force-dynamic";

const STATUS: Record<MyOvertime["status"], { label: string; className: string }> = {
  pending: { label: "Pending", className: "text-amber-600 dark:text-amber-400" },
  approved: { label: "Approved", className: "text-green-600 dark:text-green-400" },
  rejected: { label: "Rejected", className: "text-red-600 dark:text-red-400" },
};

export default async function MeOvertimePage() {
  const profile = await getCurrentProfile();
  if (profile?.must_change_password) redirect("/me/change-password");

  const rows = await getMyOvertime();

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold tracking-tight">Overtime</h1>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No overtime yet.</p>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id} className="py-3">
              <div className="text-sm font-medium">{formatWeekdayDate(r.work_date)}</div>
              <div className="text-sm tabular-nums text-muted-foreground">{formatMinutes(Math.round(r.hours * 60))}</div>
              {r.reason && <div className="text-sm text-muted-foreground">{r.reason}</div>}
              <div className={`text-sm ${STATUS[r.status].className}`}>{STATUS[r.status].label}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
