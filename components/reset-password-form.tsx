"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PASSWORD_RULES, passwordIsValid } from "@/lib/password-rules";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordReady = passwordIsValid(password);
  const confirmMismatch = confirm.length > 0 && confirm !== password;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) {
      setError("Missing reset token.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = await response.json();
      if (!json.ok) {
        setError(json.error ?? "Could not reset password.");
        return;
      }
      router.push("/login");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <div className="auth-form-intro">
        <h1>Choose a new password</h1>
        <p>Use a strong password you haven’t used elsewhere.</p>
      </div>
      {!token ? <p className="form-error">This reset link is missing a token.</p> : null}
      <label className="field">
        <span>New password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          required
        />
      </label>
      <label className="field">
        <span>Confirm password</span>
        <input
          type="password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          autoComplete="new-password"
          required
        />
      </label>
      {confirmMismatch ? <p className="field-error">Passwords do not match.</p> : null}
      <ul className="password-rules" aria-label="Password requirements">
        {PASSWORD_RULES.map((rule) => (
          <li key={rule.id} className={rule.test(password) ? "is-met" : undefined}>
            {rule.label}
          </li>
        ))}
      </ul>
      {error ? <p className="form-error">{error}</p> : null}
      <button
        className="btn btn-solid"
        type="submit"
        disabled={loading || !token || !passwordReady || confirmMismatch}
      >
        {loading ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}
