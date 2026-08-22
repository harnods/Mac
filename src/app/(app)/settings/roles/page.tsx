import { redirect } from "next/navigation";

// Roles & permissions moved into the HR module (everything crew-related lives
// under HR). Old URL kept as a redirect.
export default function LegacyRolesRedirect() {
  redirect("/hr/settings/roles");
}
