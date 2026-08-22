import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { SchedulePatternsManager } from "@/components/employees/schedule-patterns-manager";

export const dynamic = "force-dynamic";

export default async function SchedulePatternsPage() {
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.EMPLOYEES_WRITE);
  const supabase = await createClient();

  const { data } = await supabase
    .from("roster_patterns")
    .select("id,name,effective_date")
    .order("effective_date", { ascending: false });
  const patterns = (data ?? []) as { id: string; name: string | null; effective_date: string }[];

  return (
    <div className="space-y-4">
      <SchedulePatternsManager patterns={patterns} isAdmin={isAdmin} />
    </div>
  );
}
