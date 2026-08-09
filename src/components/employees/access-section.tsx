"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Check, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { grantEmployeeAccess, revokeEmployeeAccess } from "@/app/actions/employees";

type Props = {
  employeeId: string;
  employeeEmail: string | null;
  userId: string | null;
  userEmail: string | null;
  userRole: string | null;
};

export function AccessSection({ employeeId, employeeEmail, userId, userEmail, userRole }: Props) {
  const router = useRouter();

  // Grant dialog state
  const [grantOpen, setGrantOpen] = useState(false);
  const [email, setEmail] = useState(employeeEmail ?? "");
  const [role, setRole] = useState<"crew" | "admin">("crew");
  const [granting, startGrant] = useTransition();

  // Credentials dialog (shown after successful grant)
  const [credsOpen, setCredsOpen] = useState(false);
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState<"email" | "password" | null>(null);

  // Revoke state
  const [revoking, startRevoke] = useTransition();
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false);

  function handleCopy(type: "email" | "password", value: string) {
    navigator.clipboard.writeText(value);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  function handleGrant() {
    startGrant(async () => {
      const res = await grantEmployeeAccess(employeeId, { email, role });
      if (!res.ok) { toast.error(res.error); return; }
      setGrantOpen(false);
      setCreds({ email: res.email, password: res.password });
      setCredsOpen(true);
      router.refresh();
    });
  }

  function handleRevoke() {
    startRevoke(async () => {
      const res = await revokeEmployeeAccess(employeeId);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Access revoked");
      setRevokeConfirmOpen(false);
      router.refresh();
    });
  }

  const hasAccess = !!userId;

  return (
    <>
      {/* Status card */}
      <div className="border rounded-lg px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {hasAccess ? (
            <ShieldCheck className="size-5 text-green-600 shrink-0" />
          ) : (
            <ShieldOff className="size-5 text-muted-foreground shrink-0" />
          )}
          <div>
            <p className="text-sm font-medium">
              {hasAccess ? "Has system access" : "No system access"}
            </p>
            {hasAccess && userEmail && (
              <p className="text-xs text-muted-foreground">
                {userEmail} · <span className="capitalize">{userRole}</span>
              </p>
            )}
          </div>
        </div>
        {!hasAccess ? (
          <Button size="sm" variant="outline" onClick={() => { setEmail(employeeEmail ?? ""); setGrantOpen(true); }}>
            Grant access
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setRevokeConfirmOpen(true)}>
            Revoke access
          </Button>
        )}
      </div>

      {/* Grant access dialog */}
      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Grant system access</DialogTitle>
            <DialogDescription>
              A login account will be created. The password is shown once — share it with the employee.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label htmlFor="access-email">Login email</Label>
              <Input
                id="access-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="access-role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "crew" | "admin")}>
                <SelectTrigger id="access-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="crew">Crew</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setGrantOpen(false)} disabled={granting}>Cancel</Button>
              <Button onClick={handleGrant} disabled={granting || !email.trim()}>
                {granting ? "Creating..." : "Grant access"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Credentials dialog */}
      <Dialog open={credsOpen} onOpenChange={(open) => { if (!open) setCredsOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Access granted</DialogTitle>
            <DialogDescription>
              Copy these credentials and share them with the employee. The password won&apos;t be shown again.
            </DialogDescription>
          </DialogHeader>
          {creds && (
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-muted rounded px-2 py-1.5 font-mono truncate">{creds.email}</code>
                  <Button size="icon" variant="ghost" className="size-8 shrink-0" onClick={() => handleCopy("email", creds.email)}>
                    {copied === "email" ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Password</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-muted rounded px-2 py-1.5 font-mono truncate">{creds.password}</code>
                  <Button size="icon" variant="ghost" className="size-8 shrink-0" onClick={() => handleCopy("password", creds.password)}>
                    {copied === "password" ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
                  </Button>
                </div>
              </div>
              <Button className="w-full mt-2" onClick={() => setCredsOpen(false)}>Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation dialog */}
      <Dialog open={revokeConfirmOpen} onOpenChange={setRevokeConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Revoke access</DialogTitle>
            <DialogDescription>
              This will delete the login account for <strong>{userEmail}</strong>. The employee will no longer be able to sign in.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setRevokeConfirmOpen(false)} disabled={revoking}>Cancel</Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={revoking}>
              {revoking ? "Revoking..." : "Revoke access"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
