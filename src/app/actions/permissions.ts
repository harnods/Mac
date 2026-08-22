"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCurrentProfile } from "@/lib/auth";
import { can, P, ALL_PERMISSION_KEYS, isSuperRole, DEFAULT_CREW_PASSWORD } from "@/lib/permissions";

type ActionResult = { ok: true } | { ok: false; error: string };

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export type RoleWithPermissions = {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permission_keys: string[];
};

export async function getRolesWithPermissions(): Promise<RoleWithPermissions[]> {
  const supabase = await createClient();
  const { data: roles } = await supabase.from("roles").select("id,name,description,is_system").order("name");
  if (!roles) return [];
  const { data: rp } = await supabase.from("role_permissions").select("role_id,permission_key");
  const rpMap: Record<string, string[]> = {};
  for (const row of rp ?? []) {
    (rpMap[row.role_id] ??= []).push(row.permission_key);
  }
  return roles.map((r) => ({
    ...r,
    permission_keys: isSuperRole(r.name) ? [...ALL_PERMISSION_KEYS] : (rpMap[r.id] ?? []),
  }));
}

export async function setRolePermissions(roleId: string, permissionKeys: string[]): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.SETTINGS_ROLES)) return { ok: false, error: "No permission" };

  const supabase = await createClient();

  // The admin role is all-access and immutable.
  const { data: targetRole } = await supabase.from("roles").select("name").eq("id", roleId).maybeSingle();
  if (isSuperRole(targetRole?.name))
    return { ok: false, error: "The admin role always has all permissions and can't be changed." };

  // Validate every key against the catalog BEFORE any destructive write.
  // The delete + insert below are not a single transaction, so if the insert
  // failed (e.g. an unknown key hitting the FK constraint) the role would be
  // left with zero permissions — which can lock an admin out of this very page.
  if (permissionKeys.length > 0) {
    const { data: valid } = await supabase.from("permissions").select("key").in("key", permissionKeys);
    const validSet = new Set((valid ?? []).map((r) => r.key));
    const invalid = permissionKeys.filter((k) => !validSet.has(k));
    if (invalid.length > 0) return { ok: false, error: `Unknown permission(s): ${invalid.join(", ")}` };
  }

  // Delete existing
  await supabase.from("role_permissions").delete().eq("role_id", roleId);
  // Insert new
  if (permissionKeys.length > 0) {
    const { error } = await supabase.from("role_permissions").insert(
      permissionKeys.map((k) => ({ role_id: roleId, permission_key: k }))
    );
    if (error) return { ok: false, error: error.message };
  }
  updateTag("role-permissions"); // propagate to the per-role permission cache immediately
  revalidatePath("/settings", "layout");
  return { ok: true };
}

export async function createRole(input: unknown): Promise<ActionResult & { id?: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.SETTINGS_ROLES)) return { ok: false, error: "No permission" };

  const parsed = z
    .object({
      name: z.string().trim().min(1).max(40),
      description: z.string().trim().max(200).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roles")
    .insert({ name: parsed.data.name, description: parsed.data.description ?? null })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings", "layout");
  return { ok: true, id: data.id };
}

export async function deleteRole(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.SETTINGS_ROLES)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { data: role } = await supabase.from("roles").select("is_system,name").eq("id", id).maybeSingle();
  if (role?.is_system) return { ok: false, error: "Cannot delete a system role" };

  if (role) {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", role.name);
    if ((count ?? 0) > 0) return { ok: false, error: "Role is in use — reassign users first" };
  }

  const { error } = await supabase.from("roles").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings", "layout");
  return { ok: true };
}

export type UserWithRole = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_owner: boolean;
  access_backoffice: boolean;
  access_crew: boolean;
  last_sign_in_at: string | null;
};

export async function getUsersWithRoles(): Promise<UserWithRole[]> {
  const profile = await getCurrentProfile();
  if (!can(profile, P.SETTINGS_ROLES)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,is_owner,access_backoffice,access_crew")
    .order("full_name");
  const profiles = (data ?? []) as Omit<UserWithRole, "last_sign_in_at">[];

  // Last sign-in is tracked in auth.users — read it with the service role.
  const lastLogin: Record<string, string | null> = {};
  try {
    const { data: list } = await serviceClient().auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of list?.users ?? []) lastLogin[u.id] = u.last_sign_in_at ?? null;
  } catch {
    // If the service role is unavailable, fall back to no last-login data.
  }

  return profiles.map((p) => ({ ...p, last_sign_in_at: lastLogin[p.id] ?? null }));
}

export async function setUserAppAccess(
  userId: string,
  access: { backoffice: boolean; crew: boolean },
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.SETTINGS_ROLES)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { data: target } = await supabase.from("profiles").select("is_owner").eq("id", userId).maybeSingle();
  if (!target) return { ok: false, error: "User not found" };

  let backoffice = access.backoffice;
  const crew = access.crew;
  // The account owner and the current user must keep back-office access so they
  // can never lock themselves (or the owner) out of these settings.
  if (target.is_owner || userId === profile.id) backoffice = true;

  const { error } = await supabase
    .from("profiles")
    .update({ access_backoffice: backoffice, access_crew: crew })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings", "layout");
  return { ok: true };
}

/**
 * Reset a user's password back to the default (`crew-2026`).
 * When [forceChange] is true the user must set their own password on their next
 * login (must_change_password); when false they keep signing in with the
 * default password. Crew can change their own password anytime in me.machimoto.
 */
export async function resetUserPassword(
  userId: string,
  forceChange: boolean,
): Promise<ActionResult & { password?: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.SETTINGS_ROLES)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("is_owner")
    .eq("id", userId)
    .maybeSingle();
  if (!target) return { ok: false, error: "User not found" };
  if (target.is_owner)
    return { ok: false, error: "Cannot reset the account owner's password" };

  const admin = serviceClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: DEFAULT_CREW_PASSWORD,
  });
  if (error) return { ok: false, error: error.message };

  await admin
    .from("profiles")
    .update({ must_change_password: forceChange })
    .eq("id", userId);

  revalidatePath("/settings", "layout");
  return { ok: true, password: DEFAULT_CREW_PASSWORD };
}

export async function setUserRole(userId: string, role: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.SETTINGS_ROLES)) return { ok: false, error: "No permission" };

  const supabase = await createClient();

  // Guard: account owner role cannot be changed
  const { data: target } = await supabase.from("profiles").select("is_owner").eq("id", userId).maybeSingle();
  if (target?.is_owner) return { ok: false, error: "Cannot change the role of the account owner" };

  // Verify role exists
  const { data: roleData } = await supabase.from("roles").select("name").eq("name", role).maybeSingle();
  if (!roleData) return { ok: false, error: "Role not found" };

  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings", "layout");
  return { ok: true };
}

/**
 * Revoke a user's system access: deletes their login (auth user + profile) so
 * they can no longer sign in to either app. The underlying employee record is
 * kept — only the login is removed.
 */
export async function revokeUserAccess(userId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.SETTINGS_ROLES)) return { ok: false, error: "No permission" };
  if (userId === profile.id) return { ok: false, error: "You can't revoke your own access" };

  const supabase = await createClient();

  const { data: target } = await supabase.from("profiles").select("is_owner").eq("id", userId).maybeSingle();
  if (!target) return { ok: false, error: "User not found" };
  if (target.is_owner) return { ok: false, error: "Cannot revoke the account owner" };

  // Unlink any employee pointing at this login, then delete the auth user
  // (which cascades to the profile row).
  await supabase.from("employees").update({ user_id: null, updated_by: profile.id }).eq("user_id", userId);

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings", "layout");
  revalidatePath("/hr", "layout");
  return { ok: true };
}
