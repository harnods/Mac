import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getMySchedule } from "@/app/actions/crew-self";

export const dynamic = "force-dynamic";

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad(n: number) { return String(n).padStart(2, "0"); }
function toISO(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export default async function MeSchedulePage() {
  const profile = await getCurrentProfile();
  if (profile?.must_change_password) redirect("/me/change-password");

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const [ty, tm, td] = today.split("-").map(Number);
  const end = new Date(ty, tm - 1, td + 20); // ~3 weeks ahead
  const rows = await getMySchedule(today, toISO(end));
  const byDate = new Map(rows.map((r) => [r.work_date, r.shift]));

  const days: { iso: string; d: Date }[] = [];
  for (let i = 0; i <= 20; i++) {
    const d = new Date(ty, tm - 1, td + i);
    days.push({ iso: toISO(d), d });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold tracking-tight">My schedule</h1>
      <div className="divide-y rounded-lg border">
        {days.map(({ iso, d }) => {
          const shift = byDate.get(iso);
          const working = !!shift?.start_time && !!shift?.end_time;
          const isToday = iso === today;
          return (
            <div key={iso} className={`flex items-center justify-between gap-3 px-4 py-3 ${isToday ? "bg-muted/50" : ""}`}>
              <div className="flex items-baseline gap-2">
                <span className="w-10 text-sm text-muted-foreground">{WD[d.getDay()]}</span>
                <span className="text-sm font-medium tabular-nums">{d.getDate()} {MONTH[d.getMonth()]}</span>
                {isToday && <span className="text-[11px] font-medium text-primary">Today</span>}
              </div>
              <div className="text-right text-sm">
                {working ? (
                  <>
                    <div className="font-medium">{shift!.name}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {shift!.start_time!.slice(0, 5)}–{shift!.end_time!.slice(0, 5)}
                    </div>
                  </>
                ) : (
                  <span className="text-muted-foreground">{shift?.name ?? "—"}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
