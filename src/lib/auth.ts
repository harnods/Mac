"server only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

export type ProfileWithPermissions = Profile & { permissions: string[] };

export const getCurrentProfile = cache(async (): Promise<ProfileWithPermissions | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profileData }, { data: permsData }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.rpc("get_my_permissions"),
  ]);

  if (!profileData) return null;
  return {
    ...(profileData as Profile),
    permissions: (permsData as string[] | null) ?? [],
  };
});
