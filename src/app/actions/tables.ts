"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

type ActionResult = { ok: true; id: string } | { ok: false; error: string };

const tableSchema = z.object({
  name: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(40).regex(/^[a-z0-9-]+$/, "Hanya huruf kecil, angka, dan tanda -"),
});

export async function createTable(raw: unknown): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };

  const parsed = tableSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tables")
    .insert({ name: parsed.data.name, code: parsed.data.code })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/tables");
  return { ok: true, id: data.id as string };
}

export async function deleteTable(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated" };

  const supabase = await createClient();
  const { error } = await supabase.from("tables").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/tables");
  return { ok: true, id };
}
