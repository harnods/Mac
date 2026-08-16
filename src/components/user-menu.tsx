"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ClearDataDialog } from "@/components/clear-data-dialog";
import type { Profile } from "@/lib/supabase/types";
import { isSuperRole, roleLabel } from "@/lib/permissions";

export function UserMenu({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [clearOpen, setClearOpen] = useState(false);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const showClearData = isSuperRole(profile.role) && process.env.NODE_ENV !== "production";

  const initials = (profile.full_name || profile.email)
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="outline-none">
          <Avatar className="size-10">
            <AvatarFallback className="bg-[#cddbf1] text-[#0a0a0a] text-sm font-medium">{initials || "?"}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex flex-col gap-1">
            <span className="truncate">{profile.full_name || profile.email}</span>
            <span className="text-xs text-muted-foreground truncate">{profile.email}</span>
            <Badge variant={isSuperRole(profile.role) ? "default" : "secondary"} className="w-fit mt-1">
              {roleLabel(profile.role)}
            </Badge>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {showClearData && (
            <>
              <DropdownMenuItem
                onClick={() => setClearOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                Clear all data
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={signOut}>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showClearData && (
        <ClearDataDialog open={clearOpen} onOpenChange={setClearOpen} />
      )}
    </>
  );
}
