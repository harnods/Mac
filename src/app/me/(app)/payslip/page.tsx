import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getMyContext } from "@/app/actions/crew-self";
import { getCrewPayslips } from "@/app/actions/payroll-run";
import { formatRp, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MePayslipPage() {
  const profile = await getCurrentProfile();
  if (profile?.must_change_password) redirect("/me/change-password");

  const context = await getMyContext();
  if (!context?.employee) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        This account isn&rsquo;t linked to a crew profile.
      </div>
    );
  }

  const slips = await getCrewPayslips(context.employee.id);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold tracking-tight">Payslip</h1>
      {slips.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No payslip yet.</p>
      ) : (
        <ul className="divide-y">
          {slips.map((s) => {
            const earnings = s.lines?.filter((l) => l.kind === "earning") ?? [];
            const deductions = s.lines?.filter((l) => l.kind === "deduction") ?? [];
            return (
              <li key={s.id} className="space-y-3 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">
                      {formatDate(s.run.period_start)} – {formatDate(s.run.period_end)}
                    </div>
                    <div className="text-xs text-muted-foreground">Paid {formatDate(s.run.payday)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Take home</div>
                    <div className="text-lg font-semibold tabular-nums">{formatRp(s.thp)}</div>
                  </div>
                </div>

                <div className="space-y-1">
                  {earnings.map((l) => (
                    <div key={l.id} className="flex justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">{l.label}</span>
                      <span className="tabular-nums">{formatRp(l.amount)}</span>
                    </div>
                  ))}
                  {deductions.map((l) => (
                    <div key={l.id} className="flex justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">{l.label}</span>
                      <span className="tabular-nums text-red-600 dark:text-red-400">-{formatRp(l.amount)}</span>
                    </div>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
