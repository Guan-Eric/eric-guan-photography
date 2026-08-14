"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [studioName, setStudioName] = useState("");
  const [photographerName, setPhotographerName] = useState(defaultName);
  const [slug, setSlug] = useState("");
  const [timezone, setTimezone] = useState("America/Toronto");
  const [accent, setAccent] = useState("#2f5d50");
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
          accent,
        }),
      });
      const json = await response.json();
      if (!json.ok) {
        setError(json.error ?? "Could not create studio.");
        return;
      }
      router.push("/admin/settings");
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="booking-card admin-login" onSubmit={onSubmit} style={{ width: "min(520px, 100%)" }}>
      <h1>Create your studio</h1>
      <p className="field-hint">
        White-label site, booking, and gated delivery for this brand. Subdomain will be{" "}
        <code>{slug || "yourslug"}.{"{platform}"}</code>. You get a 14-day Starter trial.
      </p>
      <label className="field">
        <span>Studio name</span>
        <input
          value={studioName}
          onChange={(event) => setStudioName(event.target.value)}
          required
          minLength={2}
        />
      </label>
      <label className="field">
        <span>Photographer name</span>
        <input
          value={photographerName}
          onChange={(event) => setPhotographerName(event.target.value)}
          required
        />
      </label>
      <label className="field">
        <span>Subdomain slug</span>
        <input
          value={slug}
          onChange={(event) =>
            setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
          }
          placeholder="acmephotos"
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
      <label className="field">
        <span>Accent colour</span>
        <input
          type="color"
          value={accent}
          onChange={(event) => setAccent(event.target.value)}
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="btn btn-solid" type="submit" disabled={loading}>
        {loading ? "Creating…" : "Create studio"}
      </button>
    </form>
  );
}
