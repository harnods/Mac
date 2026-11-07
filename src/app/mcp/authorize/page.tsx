"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function AuthorizeForm() {
  const params = useSearchParams();
  const redirectUri = params.get("redirect_uri") ?? "";
  const state = params.get("state") ?? "";
  const clientId = params.get("client_id") ?? "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } }
      );

      const { data: auth, error: authErr } =
        await supabase.auth.signInWithPassword({ email, password });
      if (authErr || !auth.session) {
        setError("Email atau password salah");
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", auth.user.id)
        .single();

      if (profile?.role !== "admin") {
        setError("Hanya admin yang bisa menghubungkan MCP");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/mcp/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: auth.session.access_token,
          refresh_token: auth.session.refresh_token,
          user_id: auth.user.id,
          redirect_uri: redirectUri,
          client_id: clientId,
          state,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        setError(result.error ?? "Gagal membuat kode otorisasi");
        setLoading(false);
        return;
      }

      window.location.href = result.redirect_url;
    } catch {
      setError("Terjadi kesalahan, coba lagi");
      setLoading(false);
    }
  }

  if (!redirectUri) {
    return (
      <div style={styles.card}>
        <h1 style={styles.title}>Machitori MCP</h1>
        <p style={styles.error}>Missing redirect_uri parameter.</p>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <h1 style={styles.title}>Machitori</h1>
      <p style={styles.subtitle}>Login untuk menghubungkan MCP</p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={styles.input}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={styles.input}
        />
        {error && <p style={styles.error}>{error}</p>}
        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? "Menghubungkan..." : "Login & Hubungkan"}
        </button>
      </form>

      <p style={styles.hint}>Hanya akun admin yang dapat menghubungkan MCP.</p>
    </div>
  );
}

export default function McpAuthorizePage() {
  return (
    <div style={styles.container}>
      <Suspense
        fallback={
          <div style={styles.card}>
            <p style={styles.subtitle}>Loading...</p>
          </div>
        }
      >
        <AuthorizeForm />
      </Suspense>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f5f5f5",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: "40px 32px",
    width: 380,
    maxWidth: "90vw",
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
    textAlign: "center" as const,
  },
  subtitle: {
    margin: "8px 0 24px",
    fontSize: 14,
    color: "#666",
    textAlign: "center" as const,
  },
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
  },
  input: {
    padding: "10px 12px",
    border: "1px solid #ddd",
    borderRadius: 8,
    fontSize: 14,
    outline: "none",
  },
  button: {
    padding: "10px 16px",
    background: "#111",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 4,
  },
  error: {
    color: "#dc2626",
    fontSize: 13,
    margin: 0,
  },
  hint: {
    fontSize: 12,
    color: "#999",
    textAlign: "center" as const,
    marginTop: 16,
    marginBottom: 0,
  },
};
