"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

function CrewLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextParam = params.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    let dest = nextParam && nextParam.startsWith("/me") ? nextParam : "/me";
    try {
      const { data: signIn, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
        return;
      }
      const uid = signIn.user?.id;
      if (uid) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("must_change_password")
          .eq("id", uid)
          .maybeSingle();
        if (prof?.must_change_password) dest = "/me/change-password";
      }
    } catch {
      toast.error("Couldn't sign in. Please try again.");
      return;
    } finally {
      setLoading(false);
    }
    router.replace(dest);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
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
      <Button type="submit" className="h-11 w-full text-base" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

export default function CrewLoginPage() {
  return (
    <div className="min-h-dvh bg-muted/30">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Machimoto</h1>
          <p className="text-sm text-muted-foreground">Sign in to clock in and view your payslip.</p>
        </div>
        <Suspense fallback={null}>
          <CrewLoginForm />
        </Suspense>
      </div>
    </div>
  );
}
