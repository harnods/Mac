import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { AccessDenied } from "@/components/access-denied";
import { ChartColumn } from "lucide-react";

export const dynamic = "force-dynamic";

const REPORTS: { label: string; description: string; href: string; perm: typeof P[keyof typeof P] }[] = [
  {
    label: "Sales",
    description: "Sales totals, top products, and ingredient usage from recipes over a date range.",
    href: "/reports/sales",
    perm: P.SALES_READ,
  },
  {
    label: "Service charge",
    description: "Total service charge collected over a date range, broken down by day.",
    href: "/reports/service-charge",
    perm: P.SALES_READ,
  },
];

export default async function ReportsPage() {
  const profile = await getCurrentProfile();
  const visible = REPORTS.filter((r) => can(profile, r.perm));
  if (visible.length === 0) return <AccessDenied label="Reports" />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="rounded-lg border p-4 transition-colors hover:bg-accent/50"
          >
            <div className="flex items-center gap-2 font-medium">
              <ChartColumn className="size-4 text-muted-foreground" /> {r.label}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
