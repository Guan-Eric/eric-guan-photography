"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [studioName, setStudioName] = useState("");
  const [photographerName, setPhotographerName] = useState(defaultName);
  const [slug, setSlug] = useState("");
  const [timezone, setTimezone] = useState("America/Toronto");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studioName,
          photographerName,
          slug: slug || undefined,
          timezone,
        }),
      });
      const json = await response.json();
      if (!json.ok) {
        setError(json.error ?? "Could not create studio.");
        return;
      }
      router.push("/admin");
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
        <h1>Name your studio</h1>
        <p>
          This is the brand agents see on booking and galleries. You start with a
          14-day trial.
        </p>
      </div>
      <label className="field">
        <span>Studio name</span>
        <input
          value={studioName}
          onChange={(event) => setStudioName(event.target.value)}
          autoFocus
          required
          minLength={2}
        />
      </label>
      <label className="field">
        <span>Your name</span>
        <input
          value={photographerName}
          onChange={(event) => setPhotographerName(event.target.value)}
          required
        />
      </label>
      <label className="field">
        <span>
          Subdomain <span className="optional-marker">optional</span>
        </span>
        <input
          value={slug}
          onChange={(event) =>
            setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
          }
          placeholder="northlight"
          autoComplete="off"
        />
      </label>
      <label className="field">
        <span>Timezone</span>
        <select value={timezone} onChange={(event) => setTimezone(event.target.value)}>
          <option value="America/Toronto">America/Toronto</option>
          <option value="America/Vancouver">America/Vancouver</option>
          <option value="America/New_York">America/New_York</option>
          <option value="America/Chicago">America/Chicago</option>
          <option value="America/Los_Angeles">America/Los_Angeles</option>
          <option value="America/Denver">America/Denver</option>
        </select>
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="btn btn-solid" type="submit" disabled={loading}>
        {loading ? "Creating…" : "Open studio"}
      </button>
    </form>
  );
}
