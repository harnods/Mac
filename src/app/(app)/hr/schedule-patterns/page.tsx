import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { updaterName } from "@/lib/format";
import type { Updater } from "@/lib/supabase/types";
import { SchedulePatternsManager, type PatternRow, type PatternLog } from "@/components/employees/schedule-patterns-manager";

export const dynamic = "force-dynamic";

export default async function SchedulePatternsPage() {
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.EMPLOYEES_WRITE);
  const supabase = await createClient();

  const [{ data: patternData }, { data: logData }] = await Promise.all([
    supabase
      .from("roster_patterns")
      .select("id,name,effective_date,updated_at,updater:profiles!updated_by(full_name,email)")
      .order("effective_date", { ascending: false }),
    supabase
      .from("roster_pattern_logs")
      .select("id,pattern_id,action,changes,created_at,actor:profiles!actor_id(full_name,email)")
      .order("created_at", { ascending: false }),
  ]);

  const patterns: PatternRow[] = ((patternData ?? []) as unknown as {
    id: string; name: string | null; effective_date: string; updated_at: string | null; updater: Updater | null;
  }[]).map((p) => ({
    id: p.id,
    name: p.name,
    effective_date: p.effective_date,
    updatedAt: p.updated_at,
    updatedBy: p.updater ? updaterName(p.updater) : null,
  }));

  const logsByPattern: Record<string, PatternLog[]> = {};
  for (const l of (logData ?? []) as unknown as {
    id: string; pattern_id: string; action: string; changes: { label: string; from: string; to: string }[]; created_at: string; actor: Updater | null;
  }[]) {
    (logsByPattern[l.pattern_id] ??= []).push({
      id: l.id,
      action: l.action,
      changes: Array.isArray(l.changes) ? l.changes : [],
      createdAt: l.created_at,
      actor: l.actor ? updaterName(l.actor) : null,
    });
  }

  return (
    <div className="space-y-4">
      <SchedulePatternsManager patterns={patterns} logsByPattern={logsByPattern} isAdmin={isAdmin} />
    </div>
  );
}
