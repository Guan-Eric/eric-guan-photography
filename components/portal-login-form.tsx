"use client";

import { useState } from "react";

export function PortalLoginForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await response.json().catch(() => null);
      if (!json?.ok) {
        setError(json?.error ?? "Could not send the link.");
        return;
      }
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <p className="muted">
        If we have listings for that email, a sign-in link is on its way. Check
        your inbox.
      </p>
    );
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label className="field">
        <span>Email</span>
        <input
          type="email"
          value={email}
          required
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="btn btn-solid" type="submit" disabled={busy}>
        {busy ? "Sending…" : "Email me a link"}
      </button>
    </form>
  );
}
