import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getLoyaltySettings } from "@/app/actions/loyalty";
import { LoyaltySettingsForm } from "@/components/settings/loyalty-settings-form";

export const dynamic = "force-dynamic";

export default async function LoyaltySettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/settings");

  const { rpPerPoint } = await getLoyaltySettings();

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Loyalty Points</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Atur konversi points yang customer dapatkan setiap transaksi.
        </p>
      </div>
      <LoyaltySettingsForm rpPerPoint={rpPerPoint} />
    </div>
  );
}
