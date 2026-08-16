"server only";

import { cache } from "react";
import { cookies } from "next/headers";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/supabase/types";
import { ALL_PERMISSION_KEYS, isSuperRole } from "@/lib/permissions";

export type ProfileWithPermissions = Profile & {
  permissions: string[];
  /** Non-null when a Super admin is previewing the app as another role. */
  viewingAsRole?: string | null;
};

// Cookie holding the role a Super admin is currently previewing the app as.
export const VIEW_AS_COOKIE = "view_as_role";

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

// The signed-in user's real profile, ignoring any "view as" preview.
export const getRealProfile = cache(async (): Promise<ProfileWithPermissions | null> => {
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

export const getCurrentProfile = cache(async (): Promise<ProfileWithPermissions | null> => {
  const real = await getRealProfile();
  if (!real) return null;

  // A Super admin can preview the app as another role to see what that role can
  // access. We swap in the target role's permissions and drop owner/super
  // privileges, but keep back-office access so they stay in the app to preview.
  if (isSuperRole(real.role)) {
    const viewAs = (await cookies()).get(VIEW_AS_COOKIE)?.value;
    if (viewAs && !isSuperRole(viewAs)) {
      const permissions = await getPermissionsForRole(viewAs);
      return {
        ...real,
        role: viewAs,
        permissions,
        is_owner: false,
        access_backoffice: true,
        access_crew: false,
        viewingAsRole: viewAs,
      };
    }
  }

  return { ...real, viewingAsRole: null };
});
