import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getMyIdentity } from "@/app/actions/crew-self";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { CrewNav } from "@/components/crew/crew-nav";
import { NoAccessScreen } from "@/components/no-access-screen";

export const dynamic = "force-dynamic";

// Crew-app hosts where a back-office-only user should be bounced to the office.
const CREW_HOSTS = ["me.machimoto.cafe"];

export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/me/login");

  // Gate the crew app by per-account access; bounce to the back office if that's
  // all they have, otherwise show the no-access screen.
  if (!profile.access_crew) {
    if (profile.access_backoffice) {
      const host = ((await headers()).get("host") ?? "").toLowerCase();
      redirect(CREW_HOSTS.includes(host) ? "https://admin.machimoto.cafe" : "/");
    }
    return <NoAccessScreen />;
  }

  // During the forced first-login password change, show a bare shell (no nav).
  if (profile.must_change_password) {
    return (
      <div className="min-h-dvh bg-muted/30">
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background px-4 py-6">{children}</div>
      </div>
    );
  }

  const me = await getMyIdentity();
  const name = me?.name ?? "there";
  const initials =
    me?.name
      ?.split(" ")
      .slice(0, 2)
      .map((s) => s[0])
      .join("")
      .toUpperCase() ?? "";

  return (
    <div className="min-h-dvh bg-muted/30">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Hi,</p>
            <p className="truncate text-base font-semibold leading-tight tracking-tight">{name}</p>
          </div>
          <Avatar size="lg">
            {me?.photo_url && <AvatarImage src={me.photo_url} alt={name} />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </header>
        <main className="flex-1 px-4 py-5">{children}</main>
        <CrewNav />
      </div>
    </div>
  );
}
