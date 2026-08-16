"server only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/supabase/types";
import { ALL_PERMISSION_KEYS, isSuperRole } from "@/lib/permissions";

export type ProfileWithPermissions = Profile & { permissions: string[] };

// Permissions are a pure function of the role (see get_my_permissions SQL:
// profiles.role -> roles.name -> role_permissions). Cache per role in the Next
// Data Cache (shared across all users/requests) so we don't run the RPC on
// every navigation. A short TTL means a role's permission changes propagate
// within ~60s automatically — acceptable for a rarely-edited admin setting.
// Uses the cookie-less admin client because unstable_cache forbids cookies().
const getPermissionsForRole = unstable_cache(
  async (role: string): Promise<string[]> => {
    // The admin role always has every permission, regardless of DB rows.
    if (isSuperRole(role)) return [...ALL_PERMISSION_KEYS];
    const admin = createAdminClient();
    const { data } = await admin
      .from("role_permissions")
      .select("permission_key, roles!inner(name)")
      .eq("roles.name", role);
    return ((data ?? []) as { permission_key: string }[]).map((r) => r.permission_key);
  },
  ["role-permissions"],
  { tags: ["role-permissions"], revalidate: 60 },
);

export const getCurrentProfile = cache(async (): Promise<ProfileWithPermissions | null> => {
  const supabase = await createClient();

  // getClaims() verifies the session JWT locally (asymmetric ES256 keys +
  // globally-cached JWKS) — no network round-trip to the Auth server on every
  // navigation, unlike getUser().
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) return null;

  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (!profileData) return null;

  const profile = profileData as Profile;
  const permissions = await getPermissionsForRole(profile.role);
  return { ...profile, permissions };
});
