"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const json = await response.json();
      if (!json.ok) {
        setError(json.error ?? "Could not create account.");
        return;
      }
      const invite = new URLSearchParams(window.location.search).get("invite");
      router.push(invite ? `/invite/${invite}` : "/onboarding");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="booking-card admin-login" onSubmit={onSubmit}>
      <h1>Create photographer account</h1>
      <p className="field-hint">
        This is the SaaS signup — you get a studio after onboarding, not an agent gallery login.
      </p>
      <label className="field">
        <span>Your name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          minLength={2}
        />
      </label>
      <label className="field">
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={8}
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="btn btn-solid" type="submit" disabled={loading}>
        {loading ? "Creating…" : "Continue"}
      </button>
      <p className="field-hint">
        Already have an account? <a href="/admin/login">Sign in</a>
      </p>
    </form>
  );
}
