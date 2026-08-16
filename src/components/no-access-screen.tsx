"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

// Shown when a signed-in account has no app access at all (neither back office
// nor crew app). Signs the user out so they can't linger in a gated shell.
export function NoAccessScreen() {
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.signOut().finally(() => setSignedOut(true));
  }, []);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-muted/30 px-6 text-center">
      <ShieldAlert className="size-10 text-muted-foreground" />
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">No access</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your account doesn&apos;t have access to any app yet. Please contact an administrator to be granted access.
        </p>
      </div>
      <Button asChild variant="secondary" disabled={!signedOut}>
        <a href="/login">Back to sign in</a>
      </Button>
    </div>
  );
}
