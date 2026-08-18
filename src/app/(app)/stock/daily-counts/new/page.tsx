import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { DailyCountForm } from "@/components/stock/daily-count-form";
import { getDailyCountOptions, getDailyCountTemplates } from "@/app/actions/daily-stock";

export const dynamic = "force-dynamic";

export default async function NewDailyStockCountPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!can(profile, P.DAILY_STOCK_COUNTS_WRITE)) redirect("/stock/daily-counts");

  const [options, templates] = await Promise.all([
    getDailyCountOptions(),
    getDailyCountTemplates(),
  ]);
  if (!options.ok) redirect("/stock/daily-counts");

  return (
    <div className="flex flex-col flex-1 gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2">
          <Link href="/stock/daily-counts">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">New daily stock count</h1>
      </div>
      <DailyCountForm items={options.items} categories={options.categories} templates={templates} />
    </div>
  );
}
