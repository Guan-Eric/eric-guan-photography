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
      setMessage(`Invite sent to ${inviteEmail}.`);
      setInviteEmail("");
    } finally {
      setBusy(false);
    }
  }

  const usedGb = state ? (state.storageBytesUsed / 1e9).toFixed(2) : "—";
  const quotaGb = state ? (state.mediaQuotaBytes / 1e9).toFixed(0) : "—";
  const storagePct = state
    ? Math.min(100, (state.storageBytesUsed / Math.max(state.mediaQuotaBytes, 1)) * 100)
    : 0;
  const trialLabel = billing?.trialEndsAt
    ? new Date(billing.trialEndsAt).toLocaleDateString("en-CA", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const connectLabel =
    {
      not_started: "Not connected",
      pending: "Setup in progress",
      complete: "Connected",
      restricted: "Needs attention",
    }[state?.connectStatus ?? ""] ?? "…";

  return (
    <div className="studio-settings">
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Plan & studio</h1>
          <p className="muted">
            Storage {usedGb} / {quotaGb} GB
          </p>
          {state ? (
            <div className="storage-meter" aria-hidden="true">
              <span style={{ width: `${storagePct}%` }} />
            </div>
          ) : null}
        </div>
      </div>

      <section className="studio-section">
        <h2>Subscription</h2>
        <p className="muted">
          {billing ? (
            <>
              {billing.planLabel}
              {billing.subscriptionStatus === "trialing" && trialLabel
                ? ` · trial through ${trialLabel}`
                : ` · ${billing.subscriptionStatus}`}
              <br />
              {billing.listingsUsedYear} of {billing.listingQuotaAnnual} listings this year ·{" "}
              {billing.seatsQuota} {billing.seatsQuota === 1 ? "seat" : "seats"}
            </>
          ) : (
            "Loading…"
          )}
        </p>
        <div className="plan-pick">
          {(
            [
              ["starter", "Starter", "$49"],
              ["growth", "Growth", "$99"],
              ["studio", "Studio", "$179"],
            ] as const
          ).map(([id, label, price]) => (
            <button
              key={id}
              type="button"
              className={billing?.plan === id ? "is-current" : undefined}
              disabled={busy}
              onClick={() => checkout(id)}
            >
              <strong>{label}</strong>
              <span>{price} / month</span>
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-outline" disabled={busy} onClick={openPortal}>
          Manage billing
        </button>
      </section>

      <section className="studio-section">
        <h2>Payouts</h2>
        <p className="muted">{connectLabel}</p>
        <p className="field-hint">
          Connect Stripe so gallery payments land in your account.
        </p>
        <button type="button" className="btn btn-solid" disabled={busy} onClick={startConnect}>
          {busy ? "Working…" : state?.connectStatus === "complete" ? "Update payouts" : "Connect payouts"}
        </button>
      </section>

      <section className="studio-section">
        <h2>Custom domain</h2>
        {!state?.canCustomDomain ? (
          <p className="field-hint">Available on Growth and Studio.</p>
        ) : (
          <p className="field-hint">Point a hostname at this studio, then save it here.</p>
        )}
        <label className="field">
          <span>Domain</span>
          <input
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            placeholder="photos.yourstudio.com"
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

      <section className="studio-section">
        <h2>Team</h2>
        <p className="field-hint">Seat limit follows your plan.</p>
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
    </div>
  );
}
