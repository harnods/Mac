import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { CrewLogoutButton } from "@/components/crew/crew-logout-button";

export const dynamic = "force-dynamic";

export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/me");

  return (
    <div className="min-h-dvh bg-muted/30">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
          <Link href="/me" className="text-lg font-bold tracking-tight">Machimoto</Link>
          <CrewLogoutButton />
        </header>
        <main className="flex-1 px-4 py-5">{children}</main>
      </div>
    </div>
  );
}
