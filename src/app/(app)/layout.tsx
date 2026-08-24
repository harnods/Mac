import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canAccessHr, isSuperRole } from "@/lib/permissions";
import { NoAccessScreen } from "@/components/no-access-screen";
import { UserMenu } from "@/components/user-menu";
import { ViewAsBanner } from "@/components/view-as-banner";
import { AppSidebar } from "@/components/app-sidebar";
import { MainNavMobile } from "@/components/main-nav-mobile";
import { PerfBadge } from "@/components/perf-badge";

// Admin-side hosts where crew must be bounced to the crew app.
const ADMIN_HOSTS = ["admin.machimoto.cafe", "machimoto.cafe", "www.machimoto.cafe"];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  // App access is per-account. Without back-office access, send them to the crew
  // app if they have it, otherwise show the no-access screen.
  if (!profile.access_backoffice) {
    if (profile.access_crew) {
      const host = ((await headers()).get("host") ?? "").toLowerCase();
      redirect(ADMIN_HOSTS.includes(host) ? "https://me.machimoto.cafe" : "/me");
    }
    return <NoAccessScreen />;
  }

  const canHr = canAccessHr(profile);

  // Roles list for the Super admin "View as" preview switcher.
  const isRealSuperAdmin = !!profile.viewingAsRole || isSuperRole(profile.role);
  let roleNames: string[] = [];
  let pendingOvertime = 0;
  if (isRealSuperAdmin || canHr) {
    const supabase = await createClient();
    if (isRealSuperAdmin) {
      const { data } = await supabase.from("roles").select("name").order("name");
      roleNames = (data ?? []).map((r: { name: string }) => r.name);
    }
    if (canHr) {
      const { count } = await supabase
        .from("overtime_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      pendingOvertime = count ?? 0;
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafe]">
      <AppSidebar canHr={canHr} permissions={profile.permissions} pendingOvertime={pendingOvertime} />

      <div className="flex-1 flex flex-col min-w-0">
        {profile.viewingAsRole && <ViewAsBanner role={profile.viewingAsRole} />}
        <header className="h-[72px] shrink-0 flex items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3 md:hidden">
            <MainNavMobile canHr={canHr} permissions={profile.permissions} pendingOvertime={pendingOvertime} />
            <span className="text-2xl font-bold tracking-tight text-[#0a0a0a]">Mac</span>
          </div>
          <div className="ml-auto">
            <UserMenu profile={profile} roles={roleNames} viewingAsRole={profile.viewingAsRole ?? null} />
          </div>
        </header>

        <div className="flex-1 min-h-0 md:pr-3 md:pb-3">
          <main className="h-full bg-white md:rounded-[12px] overflow-y-auto">
            <div className="min-h-full flex flex-col px-4 sm:px-6 py-5">{children}</div>
          </main>
        </div>
      </div>
      <PerfBadge />
    </div>
  );
}
