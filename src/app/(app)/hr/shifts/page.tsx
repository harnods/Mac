import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { ShiftsManager } from "@/components/employees/shifts-manager";
import type { Shift } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function ShiftsPage() {
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.EMPLOYEES_WRITE);
  const supabase = await createClient();

  const { data } = await supabase
    .from("shifts")
    .select("id,name,start_time,end_time,break_minutes,active,updated_by,updated_at")
    .order("start_time");
  const shifts = (data ?? []) as Shift[];

  return (
    <div className="space-y-4">
      <ShiftsManager shifts={shifts} isAdmin={isAdmin} />
    </div>
  );
}
