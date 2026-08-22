import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { getRosterPattern } from "@/app/actions/schedule";
import { DetailBackButton } from "@/components/employees/detail-back-button";
import { RosterBuilder } from "@/components/employees/roster-builder";

export const dynamic = "force-dynamic";

export default async function EditSchedulePatternPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!can(profile, P.EMPLOYEES_WRITE)) redirect("/hr/schedule-patterns");

  const detail = await getRosterPattern(id);
  if (!detail) notFound();

  const supabase = await createClient();
  const { data: owner } = await supabase.from("profiles").select("id").eq("is_owner", true).maybeSingle();

  // Only currently-active crew (not resigned / inactive), minus the owner.
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

  const initialCells: Record<string, string> = {};
  for (const c of detail.cells) {
    if (c.shiftId) initialCells[`${c.employeeId}|${c.weekday}`] = c.shiftId;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <DetailBackButton href="/hr/schedule-patterns" />
        <h1 className="text-2xl font-semibold tracking-tight">Edit shift schedule</h1>
      </div>
      <RosterBuilder
        crew={crew}
        shifts={shifts}
        patternId={detail.id}
        initialName={detail.name ?? ""}
        initialEffective={detail.effective_date}
        initialCells={initialCells}
      />
    </div>
  );
}
