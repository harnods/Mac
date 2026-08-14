"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { changeMyPassword } from "@/app/actions/crew-self";

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) { toast.error("Password must be at least 6 characters."); return; }
    if (pw !== confirm) { toast.error("Passwords don't match."); return; }
    start(async () => {
      const res = await changeMyPassword(pw);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Password changed");
      router.push("/me");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{forced ? "Set a new password" : "Change password"}</h1>
        {forced && <p className="mt-1 text-sm text-muted-foreground">For security, please set your own password before continuing.</p>}
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pw">New password</Label>
          <PasswordInput id="pw" className="h-12" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <PasswordInput id="confirm" className="h-12" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <Button type="submit" className="h-12 w-full text-base" disabled={pending}>
          {pending ? "Saving..." : "Save password"}
        </Button>
      </form>
    </div>
  );
}
