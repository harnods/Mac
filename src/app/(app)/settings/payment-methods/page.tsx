import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";
import { AccessDenied } from "@/components/access-denied";
import { PaymentMethodsManager } from "@/components/settings/payment-methods-manager";

export const dynamic = "force-dynamic";

export default async function PaymentMethodsPage() {
  const profile = await getCurrentProfile();
  if (!can(profile, P.SALES_READ)) return <AccessDenied label="Payment methods" />;

  const supabase = await createClient();
  const { data } = await supabase.from("payment_methods").select("id, name").order("name");
  const methods = (data ?? []) as { id: string; name: string }[];

  return <PaymentMethodsManager methods={methods} canEdit={can(profile, P.SALES_WRITE)} />;
}
