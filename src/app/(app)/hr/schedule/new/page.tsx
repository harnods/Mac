import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { DetailBackButton } from "@/components/employees/detail-back-button";
import { RosterBuilder } from "@/components/employees/roster-builder";

export const dynamic = "force-dynamic";

export default async function NewSchedulePage() {
  const profile = await getCurrentProfile();
  if (!can(profile, P.EMPLOYEES_WRITE)) redirect("/hr/schedule");

  const supabase = await createClient();
  const { data: owner } = await supabase.from("profiles").select("id").eq("is_owner", true).maybeSingle();

  // Currently-employed crew (not resigned, active), excluding the owner.
  let crewQuery = supabase
    .from("employees")
    .select("id,name")
    .is("deleted_at", null)
    .is("termination_date", null)
    .eq("active", true)
    .order("name");
  if (owner?.id) crewQuery = crewQuery.or(`user_id.is.null,user_id.neq.${owner.id}`);

  const [{ data: crewData }, { data: shiftRows }] = await Promise.all([
    crewQuery,
    supabase.from("shifts").select("id,name,start_time,end_time,active").order("start_time", { nullsFirst: true }),
  ]);

  const crew = (crewData ?? []) as { id: string; name: string }[];
  const shifts = (shiftRows ?? []) as { id: string; name: string; start_time: string | null; end_time: string | null; active: boolean }[];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <DetailBackButton href="/hr/schedule" />
        <h1 className="text-2xl font-semibold tracking-tight">New shift schedule</h1>
      </div>
      <RosterBuilder crew={crew} shifts={shifts} />
    </div>
  );
}
