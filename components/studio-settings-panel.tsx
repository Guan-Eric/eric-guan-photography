"use client";

import { useEffect, useState } from "react";

type ConnectState = {
  connectStatus: string;
  connectAccountId: string | null;
  domain: string | null;
  slug: string;
  storageBytesUsed: number;
  mediaQuotaBytes: number;
  canCustomDomain: boolean;
  serviceAreaGate: {
    enabled: boolean;
    region: string;
    prefixes: string[];
    message: string;
  } | null;
};

type BillingState = {
  plan: string;
  planLabel: string;
  monthlyUsd: number;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  listingQuotaAnnual: number;
  listingsUsedYear: number;
  seatsQuota: number;
  hasAccess: boolean;
  entitlements: {
    customDomain: boolean;
    propertyPages: boolean;
    shareKit: boolean;
    reports: boolean;
    upsells: boolean;
  };
};

export function StudioSettingsPanel() {
  const [state, setState] = useState<ConnectState | null>(null);
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [domain, setDomain] = useState("");
  const [prefixes, setPrefixes] = useState("");
  const [gateEnabled, setGateEnabled] = useState(false);
  const [region, setRegion] = useState("none");
  const [gateMessage, setGateMessage] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [connectRes, billingRes] = await Promise.all([
      fetch("/api/admin/connect?refresh=1"),
      fetch("/api/admin/billing"),
    ]);
    const connectJson = await connectRes.json();
    const billingJson = await billingRes.json();
    if (connectJson.ok) {
      setState(connectJson);
      setDomain(connectJson.domain ?? "");
      const gate = connectJson.serviceAreaGate;
      if (gate) {
        setGateEnabled(Boolean(gate.enabled));
        setRegion(gate.region ?? "none");
        setPrefixes((gate.prefixes ?? []).join(", "));
        setGateMessage(gate.message ?? "");
      }
    }
    if (billingJson.ok) setBilling(billingJson);
  }

  useEffect(() => {
    void load();
  }, []);

  async function startConnect() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect" }),
      });
      const json = await response.json();
      if (!json.ok) {
        setError(json.error ?? "Could not start Connect.");
        return;
      }
      if (json.url) {
        window.location.href = json.url;
        return;
      }
      setMessage("Connect link created.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDomain() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "domain", domain }),
      });
      const json = await response.json();
      if (!json.ok) {
        setError(json.error ?? "Could not save domain.");
        return;
      }
      setMessage(json.note ?? "Domain saved.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function saveServiceArea() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "serviceArea",
          enabled: gateEnabled,
          region,
          prefixes,
          message: gateMessage,
        }),
      });
      const json = await response.json();
      if (!json.ok) {
        setError(json.error ?? "Could not save service area.");
        return;
      }
      setMessage("Service area saved.");
    } finally {
      setBusy(false);
    }
  }

  async function checkout(plan: "starter" | "growth" | "studio") {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const json = await response.json();
      if (!json.ok) {
        setError(json.error ?? "Checkout failed.");
        return;
      }
      if (json.url) {
        window.location.href = json.url;
        return;
      }
      setMessage(json.stubbed ? `Local plan set to ${plan}.` : "Checkout started.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function openPortal() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const json = await response.json();
      if (!json.ok) {
        setError(json.error ?? "Billing portal unavailable.");
        return;
      }
      if (json.url) window.location.href = json.url;
    } finally {
      setBusy(false);
    }
  }

  async function invite() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: "editor" }),
      });
      const json = await response.json();
      if (!json.ok) {
        setError(json.error ?? "Could not invite.");
        return;
      }
      setMessage(`Invite created: ${json.acceptPath}`);
      setInviteEmail("");
    } finally {
      setBusy(false);
    }
  }

  const usedGb = state ? (state.storageBytesUsed / 1e9).toFixed(2) : "—";
  const quotaGb = state ? (state.mediaQuotaBytes / 1e9).toFixed(0) : "—";

  return (
    <div className="booking-card" style={{ display: "grid", gap: "1.25rem" }}>
      <div>
        <p className="eyebrow">Studio settings</p>
        <h1>Plan, payments & domain</h1>
        <p className="muted">
          Slug: <code>{state?.slug ?? "…"}</code> · Storage: {usedGb} / {quotaGb} GB
        </p>
      </div>

      <section>
        <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.5rem" }}>Subscription</h2>
        <p className="muted">
          {billing ? (
            <>
              <strong>{billing.planLabel}</strong> · {billing.subscriptionStatus}
              {billing.trialEndsAt ? ` · trial until ${billing.trialEndsAt.slice(0, 10)}` : ""}
              <br />
              Listings {billing.listingsUsedYear} / {billing.listingQuotaAnnual} · seats{" "}
              {billing.seatsQuota}
            </>
          ) : (
            "Loading…"
          )}
        </p>
        <div className="admin-delivery-actions">
          <button type="button" className="btn" disabled={busy} onClick={() => checkout("starter")}>
            Starter $49
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => checkout("growth")}>
            Growth $99
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => checkout("studio")}>
            Studio $179
          </button>
          <button type="button" className="btn btn-outline" disabled={busy} onClick={openPortal}>
            Manage billing
          </button>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.5rem" }}>Stripe Connect</h2>
        <p className="muted">
          Status: <strong>{state?.connectStatus ?? "…"}</strong>
          {state?.connectAccountId ? (
            <>
              {" "}
              · <code>{state.connectAccountId}</code>
            </>
          ) : null}
        </p>
        <p className="field-hint">
          Express onboarding pays gallery Checkout into your connected account.
        </p>
        <button type="button" className="btn" disabled={busy} onClick={startConnect}>
          {busy ? "Working…" : "Start / continue Connect"}
        </button>
      </section>

      <section>
        <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.5rem" }}>Custom domain</h2>
        {!state?.canCustomDomain ? (
          <p className="field-hint">Growth or Studio plan required.</p>
        ) : null}
        <label className="field">
          <span>Domain (e.g. photos.yourbrokerage.com)</span>
          <input
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            placeholder="photos.example.com"
            disabled={!state?.canCustomDomain}
          />
        </label>
        <button
          type="button"
          className="btn btn-outline"
          disabled={busy || !state?.canCustomDomain}
          onClick={saveDomain}
        >
          Save domain
        </button>
      </section>

      <section>
        <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.5rem" }}>Service area</h2>
        <label className="field">
          <span>
            <input
              type="checkbox"
              checked={gateEnabled}
              onChange={(event) => setGateEnabled(event.target.checked)}
            />{" "}
            Gate bookings by postal / ZIP prefix
          </span>
        </label>
        <label className="field">
          <span>Region</span>
          <select value={region} onChange={(event) => setRegion(event.target.value)}>
            <option value="none">No format check</option>
            <option value="CA">Canada (postal code)</option>
            <option value="US">United States (ZIP)</option>
          </select>
        </label>
        <label className="field">
          <span>Prefixes (comma-separated, e.g. H, J4 or 100, 902)</span>
          <input value={prefixes} onChange={(event) => setPrefixes(event.target.value)} />
        </label>
        <label className="field">
          <span>Out-of-area message</span>
          <input value={gateMessage} onChange={(event) => setGateMessage(event.target.value)} />
        </label>
        <button type="button" className="btn btn-outline" disabled={busy} onClick={saveServiceArea}>
          Save service area
        </button>
      </section>

      <section>
        <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.5rem" }}>Team invites</h2>
        <p className="field-hint">Seat limit is set by your plan.</p>
        <label className="field">
          <span>Editor email</span>
          <input
            type="email"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="editor@studio.com"
          />
        </label>
        <button type="button" className="btn btn-outline" disabled={busy} onClick={invite}>
          Send invite
        </button>
      </section>

      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <p className="field-hint">
        <a href="/admin">← Back to shoot board</a>
      </p>
    </div>
  );
}
