"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toastError, toastSuccess } from "@/lib/toast";

function safeNext(raw: string | null) {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) return null;
  return raw;
}

export function AdminLoginForm({ inviteEmail }: { inviteEmail?: string | null }) {
  const searchParams = useSearchParams();
  const invite = searchParams.get("invite");
  const next = safeNext(searchParams.get("next"));
  const [email, setEmail] = useState(inviteEmail ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await response.json();
      if (!json.ok) {
        const message = json.error ?? "Login failed.";
        setError(message);
        toastError(message);
        setLoading(false);
        return;
      }
      toastSuccess("Signed in.");
      if (invite) {
        window.location.assign(`/invite/${encodeURIComponent(invite)}`);
        return;
      }
      if (next) {
        window.location.assign(
          json.hasStudio ? next : `/onboarding?next=${encodeURIComponent(next)}`,
        );
        return;
      }
      window.location.assign(json.hasStudio ? "/admin" : "/onboarding");
    } catch {
      setError("Network error.");
      toastError("Network error.");
      setLoading(false);
    }
  }

  const signupHref = invite
    ? `/signup?invite=${encodeURIComponent(invite)}`
    : next
      ? `/signup?next=${encodeURIComponent(next)}`
      : "/signup";

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <div className="auth-form-intro">
        <h1>Sign in</h1>
        <p>
          {invite
            ? inviteEmail
              ? `Sign in with ${inviteEmail} to accept your studio invite.`
              : "Sign in to accept your studio invite."
            : "Use the email you registered with to open your studio."}
        </p>
      </div>
      <label className="field">
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          readOnly={Boolean(invite && inviteEmail)}
          autoFocus
          required
        />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button
        className={`btn btn-solid${loading ? " is-busy" : ""}`}
        type="submit"
        disabled={loading}
      >
        {loading ? "Signing in…" : invite ? "Sign in & join" : "Sign in"}
      </button>
      <p className="auth-form-foot">
        New studio? <a href={signupHref}>Create an account</a>
        {" · "}
        <a href="/forgot-password">Forgot password?</a>
      </p>
    </form>
  );
}
