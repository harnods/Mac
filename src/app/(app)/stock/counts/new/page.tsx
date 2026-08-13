import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CountForm } from "@/components/stock/count-form";
import { getStockCountOptions } from "@/app/actions/stock";

export const dynamic = "force-dynamic";

export default async function NewStockCountPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!can(profile, P.STOCK_WRITE)) redirect("/stock/counts");

  const options = await getStockCountOptions();
  if (!options.ok) redirect("/stock/counts");

  return (
    <div className="flex flex-col flex-1 gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="-ml-2">
          <Link href="/stock/counts">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">New cycle count</h1>
      </div>
      <CountForm items={options.items} categories={options.categories} />
    </div>
  );
}
