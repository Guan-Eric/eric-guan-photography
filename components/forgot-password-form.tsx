"use client";

import { useState } from "react";
import { toastError, toastSuccess } from "@/lib/toast";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await response.json();
      if (!json.ok) {
        const message = json.error ?? "Could not send reset email.";
        setError(message);
        toastError(message);
        return;
      }
      setMessage(json.message);
      toastSuccess(json.message ?? "If that account exists, a reset link is on its way.");
    } catch {
      setError("Network error.");
      toastError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <div className="auth-form-intro">
        <h1>Forgot password</h1>
        <p>We’ll email a one-hour reset link if that account exists.</p>
      </div>
      <label className="field">
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          autoFocus
          required
        />
      </label>
      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      <button
        className={`btn btn-solid${loading ? " is-busy" : ""}`}
        type="submit"
        disabled={loading}
      >
        {loading ? "Sending…" : "Send reset link"}
      </button>
      <p className="auth-form-foot">
        <a href="/login">Back to sign in</a>
      </p>
    </form>
  );
}
