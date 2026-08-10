"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function CrewLogoutButton() {
  const router = useRouter();
  async function logout() {
    await createClient().auth.signOut();
    router.push("/me/login");
    router.refresh();
  }
  return (
    <Button variant="outline" className="h-11 w-full" onClick={logout}>
      Log out
    </Button>
  );
}
