"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
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
        <Input
          id="password"
          type="password"
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
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Machitori</CardTitle>
          <CardDescription>Sign in to Machimoto cafe system.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
          <div className="border rounded-md px-3 py-2.5 space-y-2 bg-muted/40">
            <p className="text-xs font-medium text-muted-foreground">Demo accounts</p>
            <div className="space-y-1">
              <div className="text-xs">
                <span className="text-muted-foreground">Admin · </span>
                <span className="font-mono select-all">admin@machimoto.local</span>
                <span className="text-muted-foreground"> / </span>
                <span className="font-mono select-all">zKS9a5yXIcLps_kJ</span>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">Staff · </span>
                <span className="font-mono select-all">staff@machimoto.local</span>
                <span className="text-muted-foreground"> / </span>
                <span className="font-mono select-all">EqRtSRKaMjPYiqjr</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
