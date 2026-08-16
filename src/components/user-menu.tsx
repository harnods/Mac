"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ClearDataDialog } from "@/components/clear-data-dialog";
import type { Profile } from "@/lib/supabase/types";
import { isSuperRole, roleLabel } from "@/lib/permissions";
import { setViewAsRole } from "@/app/actions/view-as";

export function UserMenu({
  profile,
  roles = [],
  viewingAsRole = null,
}: {
  profile: Profile;
  roles?: string[];
  viewingAsRole?: string | null;
}) {
  const router = useRouter();
  const [clearOpen, setClearOpen] = useState(false);
  const [, startTransition] = useTransition();

  // View-as is only ever applied to a real Super admin, so an active preview
  // implies the underlying account is Super admin even though profile.role now
  // shows the previewed role.
  const isRealSuperAdmin = !!viewingAsRole || isSuperRole(profile.role);
  const viewAsRoles = roles.filter((r) => !isSuperRole(r));

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  function viewAs(role: string | null) {
    startTransition(async () => {
      await setViewAsRole(role);
      router.refresh();
    });
  }

  const showClearData = isRealSuperAdmin && !viewingAsRole && process.env.NODE_ENV !== "production";

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
              {viewingAsRole ? " (preview)" : ""}
            </Badge>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {isRealSuperAdmin && viewAsRoles.length > 0 && (
            <>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Eye className="size-4" /> View as
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-44">
                  {viewingAsRole && (
                    <>
                      <DropdownMenuItem onClick={() => viewAs(null)}>
                        Exit preview (Super admin)
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {viewAsRoles.map((r) => (
                    <DropdownMenuItem key={r} onClick={() => viewAs(r)} className="justify-between">
                      <span>{roleLabel(r)}</span>
                      {viewingAsRole === r && <Check className="size-4" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
            </>
          )}

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
