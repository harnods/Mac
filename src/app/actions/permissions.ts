"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { can, P } from "@/lib/permissions";

type ActionResult = { ok: true } | { ok: false; error: string };

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
  return roles.map((r) => ({ ...r, permission_keys: rpMap[r.id] ?? [] }));
}

export async function setRolePermissions(roleId: string, permissionKeys: string[]): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };
  if (!can(profile, P.SETTINGS_ROLES)) return { ok: false, error: "No permission" };

  const supabase = await createClient();
  // Delete existing
  await supabase.from("role_permissions").delete().eq("role_id", roleId);
  // Insert new
  if (permissionKeys.length > 0) {
    const { error } = await supabase.from("role_permissions").insert(
      permissionKeys.map((k) => ({ role_id: roleId, permission_key: k }))
    );
    if (error) return { ok: false, error: error.message };
  }
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

export async function getUsersWithRoles() {
  const profile = await getCurrentProfile();
  if (!can(profile, P.SETTINGS_ROLES)) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id,email,full_name,role,is_owner").order("full_name");
  return data ?? [];
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
