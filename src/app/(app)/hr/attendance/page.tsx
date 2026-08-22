import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AttendanceDateBar } from "@/components/employees/attendance-date-bar";
import { AttendanceFilter } from "@/components/employees/attendance-filter";
import { AttendanceTable } from "@/components/employees/attendance-table";
import { AttendanceFormDialog } from "@/components/employees/attendance-form-dialog";
import { getAttendanceFormData, getAttendanceSettings } from "@/app/actions/attendance";
import type { AttendanceWithRelations } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

function todayJakarta() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; date?: string }>;
}) {
  const { q = "", date: rawDate } = await searchParams;
  const today = todayJakarta();
  const date = rawDate && DATE_RE.test(rawDate) ? rawDate : today;

  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const canWrite = can(profile, P.EMPLOYEES_WRITE);

  const [{ data: items }, formData, settings] = await Promise.all([
    (() => {
      let query = supabase
        .from("attendance")
        .select(
          "*, employees!inner(id,name), shifts(id,name,start_time,end_time), creator:profiles!created_by(full_name,email), updater:profiles!updated_by(full_name,email)",
        )
        .eq("work_date", date)
        .order("clock_in", { ascending: true, nullsFirst: false });
      if (q.trim()) query = query.ilike("employees.name", `%${q.trim()}%`);
      return query;
    })(),
    getAttendanceFormData(),
    getAttendanceSettings(),
  ]);

  const grace = {
    lateGraceMinutes: settings?.late_grace_minutes ?? 0,
    lateToleranceDirection: settings?.late_tolerance_direction ?? "after",
    earlyLeaveGraceMinutes: settings?.early_leave_grace_minutes ?? 0,
  };

  // Hide "No schedule" rows (part-timers not rostered that day) from the index.
  const list = ((items ?? []) as unknown as AttendanceWithRelations[]).filter(
    (r) => r.shifts?.name !== "No schedule",
  );
  const emptyFormData = { crew: [], shifts: [] };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
        {canWrite && formData && (
          <AttendanceFormDialog
            formData={formData}
            trigger={
              <Button>
                <Plus className="size-4" /> Add attendance
              </Button>
            }
          />
        )}
      </div>

      <Suspense fallback={null}>
        <AttendanceDateBar selectedDate={date} today={today} />
      </Suspense>

      <Suspense fallback={null}>
        <AttendanceFilter />
      </Suspense>

      {list.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-sm text-muted-foreground">
          {q.trim() ? "No crew match your search on this day." : "No attendance recorded on this day."}
        </div>
      ) : (
        <AttendanceTable list={list} canWrite={canWrite} formData={formData ?? emptyFormData} grace={grace} />
      )}
    </div>
  );
}
