"use client";

import { useState } from "react";
import { CurrencySelect } from "@/components/currency-select";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import { normalizeStudioCurrency } from "@/lib/currency";
import { toastError, toastSuccess } from "@/lib/toast";
import type { Tenant } from "@/lib/tenant-schema";

export function StudioBookingEditor({
  tenant,
  viewUrl,
}: {
  tenant: Tenant;
  viewUrl: string;
}) {
  const gate = tenant.serviceAreaGate;
  const [turnaround, setTurnaround] = useState(tenant.turnaround);
  const [email, setEmail] = useState(tenant.email);
  const [phone, setPhone] = useState(tenant.phone ?? "");
  const [currency, setCurrency] = useState(
    normalizeStudioCurrency(tenant.seo.currency),
  );
  const [gateEnabled, setGateEnabled] = useState(Boolean(gate?.enabled));
  const [region, setRegion] = useState<"CA" | "US" | "none">(gate?.region ?? "none");
  const [prefixes, setPrefixes] = useState((gate?.prefixes ?? []).join(", "));
  const [gateMessage, setGateMessage] = useState(
    gate?.message ?? "This studio does not currently cover that area.",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const current = JSON.stringify({
    turnaround,
    email,
    phone,
    currency,
    gateEnabled,
    region,
    prefixes,
    gateMessage,
  });
  const [saved, setSaved] = useState(current);
  useUnsavedChanges(current !== saved);

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/site", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "booking",
          turnaround,
          email,
          phone,
          currency,
          serviceAreaGate: {
            enabled: gateEnabled,
            region,
            prefixes,
            message: gateMessage,
          },
        }),
      });
      const json = await response.json();
      if (!json.ok) {
        setError(json.error ?? "Could not save.");
        toastError(json.error ?? "Could not save.");
        return;
      }
      setMessage("Booking settings saved.");
      toastSuccess("Booking settings saved.");
      setSaved(current);
    } catch {
      setError("Network error.");
      toastError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="studio-settings" onSubmit={onSave}>
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">Booking</p>
          <h1>How agents request a shoot</h1>
        </div>
        <a className="btn btn-outline" href={viewUrl} target="_blank" rel="noreferrer">
          View on site
        </a>
      </div>

      <section className="studio-section">
        <h2>Contact</h2>
        <label className="field">
          <span>Turnaround</span>
          <input
            value={turnaround}
            onChange={(event) => setTurnaround(event.target.value)}
            placeholder="24–48 hours"
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
          <span>Phone</span>
          <input value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
        <label className="field">
          <span>Currency for packages &amp; galleries</span>
          <CurrencySelect value={currency} onChange={setCurrency} required />
          <span className="field-hint">
            New quotes and gallery checkouts use this currency. Existing unpaid
            orders keep the currency they were booked with. Studiofront SaaS
            billing stays in USD.
          </span>
        </label>
      </section>

      <section className="studio-section">
        <h2>Service area</h2>
        <label className="field field-check">
          <span>
            <input
              type="checkbox"
              checked={gateEnabled}
              onChange={(event) => setGateEnabled(event.target.checked)}
            />{" "}
            Only accept bookings in listed postal / ZIP prefixes
          </span>
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Region</span>
            <select
              value={region}
              onChange={(event) =>
                setRegion(event.target.value as "CA" | "US" | "none")
              }
            >
              <option value="none">No format check</option>
              <option value="CA">Canada (postal code)</option>
              <option value="US">United States (ZIP)</option>
            </select>
          </label>
          <label className="field">
            <span>Prefixes</span>
            <input
              value={prefixes}
              onChange={(event) => setPrefixes(event.target.value)}
              placeholder="H, J4 or 100, 902"
            />
          </label>
        </div>
        <label className="field">
          <span>Out-of-area message</span>
          <input value={gateMessage} onChange={(event) => setGateMessage(event.target.value)} />
        </label>
      </section>

      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      <button className={`btn btn-solid${busy ? " is-busy" : ""}`} type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save booking"}
      </button>
    </form>
  );
}
