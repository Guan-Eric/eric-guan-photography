"use client";

import { useState } from "react";
import { toastError, toastSuccess } from "@/lib/toast";

export function PortalLoginForm({ next }: { next?: string | null }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next: next || undefined }),
      });
      const json = await response.json().catch(() => null);
      if (!json?.ok) {
        const message = json?.error ?? "Could not send the code.";
        setError(message);
        toastError(message);
        return;
      }
      setStep("code");
      toastSuccess("If we have listings for that email, a sign-in code is on its way.");
    } catch {
      setError("Network error.");
      toastError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/portal/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, next: next || undefined }),
      });
      const json = await response.json().catch(() => null);
      if (!json?.ok) {
        const message = json?.error ?? "That code is incorrect or expired.";
        setError(message);
        toastError(message);
        return;
      }
      toastSuccess("Signed in.");
      window.location.href = typeof json.redirectTo === "string" ? json.redirectTo : "/portal";
    } catch {
      setError("Network error.");
      toastError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "code") {
    return (
      <form className="auth-form" onSubmit={verifyCode}>
        <p className="muted">
          If we have listings for that email, a 6-digit code is on its way to{" "}
          <strong>{email}</strong>.
        </p>
        <label className="field">
          <span>Sign-in code</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            required
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button
          className={`btn btn-solid${busy ? " is-busy" : ""}`}
          type="submit"
          disabled={busy || code.length !== 6}
        >
          {busy ? "Checking…" : "Sign in"}
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          disabled={busy}
          onClick={() => {
            setStep("email");
            setCode("");
            setError(null);
          }}
        >
          Use a different email
        </button>
      </form>
    );
  }

  return (
    <form className="auth-form" onSubmit={sendCode}>
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
      <button
        className={`btn btn-solid${busy ? " is-busy" : ""}`}
        type="submit"
        disabled={busy}
      >
        {busy ? "Sending…" : "Email me a code"}
      </button>
    </form>
  );
}
