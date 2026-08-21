"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CurrencySelect } from "@/components/currency-select";
import { TimezoneSelect } from "@/components/timezone-select";
import { DEFAULT_STUDIO_CURRENCY } from "@/lib/currency";
import { toastError, toastSuccess } from "@/lib/toast";
import { DEFAULT_STUDIO_TIMEZONE } from "@/lib/timezones";

function safeNext(raw: string | null) {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) return null;
  return raw;
}

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const [studioName, setStudioName] = useState("");
  const [photographerName, setPhotographerName] = useState(defaultName);
  const [slug, setSlug] = useState("");
  const [timezone, setTimezone] = useState(DEFAULT_STUDIO_TIMEZONE);
  const [currency, setCurrency] = useState(DEFAULT_STUDIO_CURRENCY);
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
          currency,
        }),
      });
      const json = await response.json();
      if (!json.ok) {
        const message = json.error ?? "Could not create studio.";
        setError(message);
        toastError(message);
        return;
      }
      toastSuccess("Studio created.");
      router.push(next ?? "/admin");
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
        <TimezoneSelect value={timezone} onChange={setTimezone} required />
        <span className="field-hint">
          Shoot times and availability use this timezone.
        </span>
      </label>
      <label className="field">
        <span>Currency for packages &amp; galleries</span>
        <CurrencySelect value={currency} onChange={setCurrency} required />
        <span className="field-hint">
          Agents pay you in this currency. Studiofront SaaS billing stays in USD.
        </span>
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button
        className={`btn btn-solid${loading ? " is-busy" : ""}`}
        type="submit"
        disabled={loading}
      >
        {loading ? "Creating…" : "Open studio"}
      </button>
    </form>
  );
}
