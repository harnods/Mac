import { getCurrentProfile } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/crew/change-password-form";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const profile = await getCurrentProfile();
  return <ChangePasswordForm forced={!!profile?.must_change_password} />;
}
