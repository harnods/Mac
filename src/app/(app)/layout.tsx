import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { canAccessHr } from "@/lib/permissions";
import { UserMenu } from "@/components/user-menu";
import { AppSidebar } from "@/components/app-sidebar";
import { MainNavMobile } from "@/components/main-nav-mobile";
import { PerfBadge } from "@/components/perf-badge";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const canHr = canAccessHr(profile);

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafe]">
      <AppSidebar canHr={canHr} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[72px] shrink-0 flex items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3 md:hidden">
            <MainNavMobile canHr={canHr} />
            <span className="text-2xl font-bold tracking-tight text-[#0a0a0a]">Mac</span>
          </div>
          <div className="ml-auto">
            <UserMenu profile={profile} />
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
