import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { canAccessHr } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/** The HR module requires the employees permission. Crew (and anyone without it) are redirected out. */
export default async function HrLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/hr/crew");
  if (!canAccessHr(profile)) {
    redirect(profile.role === "crew" ? "/me" : "/inventory");
  }
  return <>{children}</>;
}
