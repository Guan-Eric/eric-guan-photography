"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PASSWORD_RULES, passwordIsValid } from "@/lib/password-rules";
import { toastError, toastSuccess } from "@/lib/toast";

/** Kept local so the client bundle never pulls in the Drizzle schema. */
const PLAN_PARAMS = ["payg", "starter", "growth", "studio"];

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invite = searchParams.get("invite");
  const ref = searchParams.get("ref");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studioName, setStudioName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordReady = passwordIsValid(password);
  const confirmMismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = passwordReady && !confirmMismatch && !loading;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      toastError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          studioName: invite ? undefined : studioName,
          email,
          password,
          invite: invite || undefined,
          referralCode: ref || undefined,
        }),
      });
      const json = await response.json();
      if (!json.ok) {
        const message = json.error ?? "Could not create account.";
        setError(message);
        toastError(message);
        return;
      }
      toastSuccess("Account created.");
      if (invite) {
        router.push(`/invite/${invite}`);
      } else if (json.hasStudio) {
        const plan = searchParams.get("plan");
        const allowed = plan ? PLAN_PARAMS.includes(plan) : false;
        router.push(
          allowed ? `/admin?welcome=1&plan=${plan}` : "/admin?welcome=1",
        );
      } else {
        router.push("/onboarding");
      }
      router.refresh();
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
        <h1>Create your account</h1>
        <p>
          {invite
            ? "You’ll join the studio that invited you after this step."
            : "Enter the details below to set up your studio."}
        </p>
      </div>

      <div className="form-grid">
        <label className="field">
          <span>First name</span>
          <input
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            autoComplete="given-name"
            autoFocus
            required
          />
        </label>
        <label className="field">
          <span>Last name</span>
          <input
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            autoComplete="family-name"
            required
          />
        </label>
      </div>

      {invite ? null : (
        <label className="field">
          <span>Studio name</span>
          <input
            value={studioName}
            onChange={(event) => setStudioName(event.target.value)}
            autoComplete="organization"
            placeholder="Northlight Media"
            required
            minLength={2}
          />
        </label>
      )}

      <label className="field">
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
      </label>

      <label className="field">
        <span>Password</span>
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
        className={`btn btn-solid${loading ? " is-busy" : ""}`}
        type="submit"
        disabled={!canSubmit}
      >
        {loading ? "Creating…" : "Create account"}
      </button>

      <p className="auth-form-foot">
        Already have an account? <a href="/login">Sign in</a>
      </p>
    </form>
  );
}
