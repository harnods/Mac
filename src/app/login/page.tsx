"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const DEMO_ACCOUNTS = [
  { label: "Admin", email: "admin@machimoto.local", password: "admin-mac-2026" },
  { label: "Staff", email: "staff@machimoto.local", password: "mac-staff-2025" },
  { label: "Ian", email: "ian@machimoto.local", password: "ian-2026" },
];

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/inventory";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    let dest = next;
    try {
      const { data: signIn, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
        return;
      }
      // Route crew to their mobile app; force a password change if required.
      const uid = signIn.user?.id;
      if (uid) {
        const { data: prof } = await supabase.from("profiles").select("role, must_change_password").eq("id", uid).maybeSingle();
        if (prof?.role === "crew") {
          // Crew belong on me.machimoto.cafe only — never the back-office.
          const host = window.location.hostname.toLowerCase();
          if (["admin.machimoto.cafe", "machimoto.cafe", "www.machimoto.cafe"].includes(host)) {
            window.location.href = "https://me.machimoto.cafe";
            return;
          }
          dest = prof.must_change_password ? "/me/change-password" : "/me";
        } else if (prof?.must_change_password) {
          dest = "/me/change-password";
        }
      }
    } catch {
      toast.error("Could not reach Supabase. Check that local Supabase is running.");
      return;
    } finally {
      setLoading(false);
    }

    router.replace(dest);
    router.refresh();
  }

  function fillDemoAccount(account: (typeof DEMO_ACCOUNTS)[number]) {
    setEmail(account.email);
    setPassword(account.password);
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      {process.env.NODE_ENV !== "production" && (
        <div className="border rounded-md px-3 py-2.5 space-y-2 bg-muted/40">
          <p className="text-xs font-medium text-muted-foreground">Demo accounts</p>
          <div className="space-y-2">
            {DEMO_ACCOUNTS.map((account) => (
              <div key={account.email} className="flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <div className="font-medium">{account.label}</div>
                  <div className="truncate font-mono select-all">{account.email}</div>
                  <div className="truncate font-mono select-all text-muted-foreground">{account.password}</div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0 text-xs"
                  onClick={() => fillDemoAccount(account)}
                >
                  Use
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Mac</CardTitle>
          <CardDescription>Welcome back</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
