"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import type { ActionResult } from "./inventory";

export async function clearAllData(): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return { ok: false, error: "Admin only" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("clear_all_data");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
