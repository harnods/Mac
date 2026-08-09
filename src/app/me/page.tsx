import Link from "next/link";
import { redirect } from "next/navigation";
import { History } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { getMyContext } from "@/app/actions/crew-self";
import { ClockCard } from "@/components/crew/clock-card";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const profile = await getCurrentProfile();
  if (profile?.must_change_password) redirect("/me/change-password");

  const context = await getMyContext();

  if (!context?.employee) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        This account isn&rsquo;t linked to a crew profile. Ask an admin to set it up.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ClockCard context={context} />
      <Link href="/me/history" className="flex items-center justify-center gap-2 rounded-lg border py-3 text-sm font-medium hover:bg-muted/50">
        <History className="size-4" /> My attendance history
      </Link>
    </div>
  );
}
