"use client";

import { Suspense, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { mcpAuthorize } from "./actions";

function AuthorizeForm() {
  const params = useSearchParams();
  const redirectUri = params.get("redirect_uri") ?? "";
  const state = params.get("state") ?? "";
  const clientId = params.get("client_id") ?? "";

  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    form.set("redirect_uri", redirectUri);
    form.set("client_id", clientId);
    form.set("state", state);

    startTransition(async () => {
      const result = await mcpAuthorize(form);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.redirect_url) {
        window.location.href = result.redirect_url;
      }
    });
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
          name="email"
          type="email"
          placeholder="Email"
          required
          autoComplete="email"
          style={styles.input}
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          autoComplete="current-password"
          style={styles.input}
        />
        {error && <p style={styles.error}>{error}</p>}
        <button type="submit" disabled={isPending} style={styles.button}>
          {isPending ? "Menghubungkan..." : "Login & Hubungkan"}
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
