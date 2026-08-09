import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { getAttendanceSettings } from "@/app/actions/attendance";
import { AttendanceSettingsView } from "@/components/employees/attendance-settings-view";

export const dynamic = "force-dynamic";

export default async function AttendanceSettingsPage() {
  const profile = await getCurrentProfile();
  const isAdmin = can(profile, P.EMPLOYEES_WRITE);
  const settings = await getAttendanceSettings();

  return <AttendanceSettingsView settings={settings} isAdmin={isAdmin} />;
}
