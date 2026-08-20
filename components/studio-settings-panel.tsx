"use client";

import { useEffect, useState } from "react";
import { PLAN_DEFS } from "@/lib/plan-defs";
import { toastError, toastSuccess } from "@/lib/toast";

type ConnectState = {
  connectStatus: string;
  connectAccountId: string | null;
  connectNote?: string;
  customDomainsEnabled?: boolean;
  customDomainNote?: string;
  domain: string | null;
  slug: string;
  storageBytesUsed: number;
  mediaQuotaBytes: number;
  canCustomDomain: boolean;
  domainVerified?: boolean;
  domainLive?: boolean;
  domainStatus?: string | null;
  domainCfStatus?: string | null;
  domainSslStatus?: string | null;
  expectedDnsTarget?: string;
  note?: string;
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
  metering: {
    enabled: boolean;
    unitUsd: number;
    meteredListings: number;
    meteredUsd: number;
  };
  domains: {
    active: number;
    unitUsd: number;
    monthlyUsd: number;
  };
  projectedMonthlyUsd: number;
  referralCode: string | null;
};

const PLAN_CHOICES = (
  [
    ["payg", PLAN_DEFS.payg.label, `$0 + $${PLAN_DEFS.payg.meteredUsd} / listing`],
    ["starter", PLAN_DEFS.starter.label, `$${PLAN_DEFS.starter.monthlyUsd} / month`],
    ["growth", PLAN_DEFS.growth.label, `$${PLAN_DEFS.growth.monthlyUsd} / month`],
    ["studio", PLAN_DEFS.studio.label, `$${PLAN_DEFS.studio.monthlyUsd} / month`],
  ] as const
);

type PlanChoice = (typeof PLAN_CHOICES)[number][0];

function usd(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function StudioSettingsPanel() {
  const [state, setState] = useState<ConnectState | null>(null);
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [members, setMembers] = useState<
    Array<{ id: string; email: string; name: string; role: string }>
  >([]);
  const [invites, setInvites] = useState<
    Array<{ id: string; email: string; role: string }>
  >([]);
  const [canManageTeam, setCanManageTeam] = useState(false);
  const [domain, setDomain] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<
    | "connect"
    | "domain"
    | "domainCheck"
    | "checkout"
    | "portal"
    | "invite"
    | `remove-invite:${string}`
    | `remove-member:${string}`
    | null
  >(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanChoice | null>(null);

  async function load() {
    try {
      const [connectRes, billingRes, invitesRes] = await Promise.all([
        fetch("/api/admin/connect?refresh=1"),
        fetch("/api/admin/billing"),
        fetch("/api/admin/invites"),
      ]);
      const connectJson = await connectRes.json().catch(() => null);
      const billingJson = await billingRes.json().catch(() => null);
      const invitesJson = await invitesRes.json().catch(() => null);
      if (connectJson?.ok) {
        setState(connectJson);
        setDomain(connectJson.domain ?? "");
      } else if (connectJson?.error) {
        setError(connectJson.error);
      }
      if (billingJson?.ok) setBilling(billingJson);
      if (invitesJson?.ok) {
        setMembers(invitesJson.members ?? []);
        setInvites(invitesJson.invites ?? []);
        setCanManageTeam(Boolean(invitesJson.canManageTeam));
      }
    } catch {
      setError("Could not load settings.");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function startConnect() {
    setBusy("connect");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect" }),
      });
      const json = await response.json().catch(() => null);
      if (!json?.ok) {
        setError(json?.error ?? "Could not start Connect.");
        toastError(json?.error ?? "Could not start Connect.");
        return;
      }
      if (json.url) {
        window.location.href = json.url;
        return;
      }
      setMessage("Connect link created.");
      toastSuccess("Connect link created.");
    } catch {
      setError("Could not start Connect.");
      toastError("Could not start Connect.");
    } finally {
      setBusy(null);
    }
  }

  async function saveDomain() {
    setBusy("domain");
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
        toastError(json.error ?? "Could not save domain.");
        if (json.note) setMessage(json.note);
        return;
      }
      const status =
        json.domainLive || json.domainStatus === "active"
          ? "Custom domain is live."
          : json.domainStatus === "pending"
            ? "Saved — waiting on DNS/SSL."
            : json.domainStatus === "cleared"
              ? "Domain cleared."
              : json.domainStatus === "error"
                ? "Saved with an error — check status below."
                : "Domain saved.";
      setMessage(json.note ? `${status} ${json.note}` : status);
      toastSuccess(json.note ? `${status} ${json.note}` : status);
      await load();
    } finally {
      setBusy(null);
    }
  }

  function domainPhase(current: ConnectState | null): {
    key: "none" | "live" | "dns" | "ssl" | "error";
    title: string;
    detail: string;
  } {
    if (!current?.domain) {
      return {
        key: "none",
        title: "Not set",
        detail: "Save a hostname to start DNS and SSL checks.",
      };
    }
    if (current.domainLive || current.domainStatus === "active") {
      return {
        key: "live",
        title: "Live",
        detail: `https://${current.domain} is serving this studio over HTTPS.`,
      };
    }
    if (current.domainStatus === "error") {
      return {
        key: "error",
        title: "Needs attention",
        detail:
          current.note ??
          "Provisioning failed. Fix DNS, then save or check status again.",
      };
    }
    if (current.domainVerified) {
      return {
        key: "ssl",
        title: "Waiting on SSL",
        detail:
          "DNS looks correct. Certificate usually finishes in a few minutes — check status again shortly.",
      };
    }
    const target = current.expectedDnsTarget ?? "sites.studiofront.ca";
    return {
      key: "dns",
      title: "Waiting on DNS",
      detail: `Add a CNAME from ${current.domain} → ${target}, wait for propagation (often minutes), then check status.`,
    };
  }

  async function checkDomainStatus() {
    setBusy("domainCheck");
    setError(null);
    try {
      await load();
      setMessage("Domain status refreshed.");
      toastSuccess("Domain status refreshed.");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (!state?.domain || state.domainLive || state.domainStatus === "active") {
      return;
    }
    const timer = window.setInterval(() => {
      void load();
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [state?.domain, state?.domainLive, state?.domainStatus]);

  async function checkout(plan: PlanChoice) {
    setBusy("checkout");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const json = await response.json().catch(() => null);
      if (!json?.ok) {
        setError(json?.error ?? "Checkout failed.");
        toastError(json?.error ?? "Checkout failed.");
        return;
      }
      if (json.url) {
        window.location.href = json.url;
        return;
      }
      setMessage(json.stubbed ? `Local plan set to ${plan}.` : "Checkout started.");
      toastSuccess(json.stubbed ? `Local plan set to ${plan}.` : "Opening checkout…");
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy("portal");
    setError(null);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const json = await response.json().catch(() => null);
      if (!json?.ok) {
        setError(json?.error ?? "Billing portal unavailable.");
        toastError(json?.error ?? "Billing portal unavailable.");
        return;
      }
      if (json.url) window.location.href = json.url;
    } finally {
      setBusy(null);
    }
  }

  async function invite() {
    setBusy("invite");
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
        toastError(json.error ?? "Could not invite.");
        return;
      }
      setMessage(`Invite sent to ${inviteEmail}.`);
      toastSuccess(`Invite sent to ${inviteEmail}.`);
      setInviteEmail("");
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function cancelInvite(inviteId: string, email: string) {
    setBusy(`remove-invite:${inviteId}`);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/invites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      const json = await response.json().catch(() => null);
      if (!json?.ok) {
        setError(json?.error ?? "Could not cancel invite.");
        toastError(json?.error ?? "Could not cancel invite.");
        return;
      }
      setMessage(`Invite cancelled for ${email}.`);
      toastSuccess(`Invite cancelled for ${email}.`);
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function removeMember(membershipId: string, email: string) {
    setBusy(`remove-member:${membershipId}`);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/invites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId }),
      });
      const json = await response.json().catch(() => null);
      if (!json?.ok) {
        setError(json?.error ?? "Could not remove team member.");
        toastError(json?.error ?? "Could not remove team member.");
        return;
      }
      setMessage(`${email} removed from the team.`);
      toastSuccess(`${email} removed from the team.`);
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (!loaded) {
    return (
      <div className="studio-settings">
        <div className="admin-toolbar">
          <div>
            <p className="eyebrow">Settings</p>
            <h1>Plan & studio</h1>
            <p className="muted">Loading studio settings…</p>
          </div>
        </div>
        <div className="settings-skeleton" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }

  const usedGb = state ? (state.storageBytesUsed / 1e9).toFixed(2) : "—";
  const quotaGb = state ? (state.mediaQuotaBytes / 1e9).toFixed(0) : "—";
  const phase = domainPhase(state);
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
  const activePlan = (billing?.plan as PlanChoice | undefined) ?? null;
  const previewPlan = selectedPlan ?? activePlan;
  const previewDef = previewPlan ? PLAN_DEFS[previewPlan] : null;

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
              {billing.plan === "payg"
                ? `${billing.listingsUsedYear} listings this year · billed per listing`
                : `${billing.listingsUsedYear} of ${billing.listingQuotaAnnual} listings this year`}{" "}
              · {billing.seatsQuota} {billing.seatsQuota === 1 ? "seat" : "seats"}
            </>
          ) : (
            "Loading…"
          )}
        </p>

        {billing ? (
          <dl className="usage-meter">
            <div>
              <dt>Listings this period</dt>
              <dd>
                {billing.listingsUsedYear}
                {billing.plan === "payg"
                  ? ""
                  : ` / ${billing.listingQuotaAnnual}`}
              </dd>
            </div>
            <div>
              <dt>{billing.plan === "payg" ? "Per listing" : "Beyond plan"}</dt>
              <dd>
                {billing.metering.enabled
                  ? `${billing.metering.meteredListings} × ${usd(billing.metering.unitUsd)} = ${usd(billing.metering.meteredUsd)}`
                  : "Not metered"}
              </dd>
            </div>
            <div>
              <dt>Custom domains</dt>
              <dd>
                {billing.domains.active} ×{" "}
                {usd(billing.domains.unitUsd)} = {usd(billing.domains.monthlyUsd)}
              </dd>
            </div>
            <div>
              <dt>Projected invoice</dt>
              <dd>
                <strong>{usd(billing.projectedMonthlyUsd)}</strong>
              </dd>
            </div>
          </dl>
        ) : null}

        <div className="plan-pick">
          {PLAN_CHOICES.map(([id, label, price]) => (
            <button
              key={id}
              type="button"
              className={previewPlan === id ? "is-current" : undefined}
              disabled={busy !== null}
              onClick={() => setSelectedPlan(id)}
            >
              <strong>{label}</strong>
              <span>{price}</span>
            </button>
          ))}
        </div>
        {previewDef ? (
          <div className="field-hint" style={{ marginTop: "0.75rem" }}>
            <strong>{previewDef.label} includes:</strong>{" "}
            {previewDef.listingQuota} listings/year, {previewDef.seats}{" "}
            {previewDef.seats === 1 ? "seat" : "seats"},{" "}
            {(previewDef.storageBytes / 1e9).toFixed(0)} GB storage
            {previewDef.monthlyUsd > 0 ? `, ${usd(previewDef.monthlyUsd)}/month` : ", $0/month"}.
          </div>
        ) : null}
        {previewPlan ? (
          <button
            type="button"
            className={`btn btn-solid${busy === "checkout" ? " is-busy" : ""}`}
            disabled={busy !== null || !billing || previewPlan === activePlan}
            onClick={() => checkout(previewPlan)}
          >
            {previewPlan === activePlan
              ? "Current plan"
              : busy === "checkout"
                ? "Opening checkout…"
                : `Switch to ${PLAN_DEFS[previewPlan].label}`}
          </button>
        ) : null}
        <p className="field-hint">
          Pay as you go has no monthly fee: every listing you complete is billed
          at {usd(billing?.metering.unitUsd ?? 5)}. Flat plans include a listing
          allowance and only meter what you shoot beyond it.
        </p>
        <button type="button" className={`btn btn-outline${busy === "portal" ? " is-busy" : ""}`} disabled={busy !== null} onClick={openPortal}>
          {busy === "portal" ? "Opening…" : "Manage billing"}
        </button>
      </section>

      <section className="studio-section">
        <h2>Payouts</h2>
        <p className="muted">{connectLabel}</p>
        <p className="field-hint">
          Connect Stripe so gallery payments land in your account.
        </p>
        {state?.connectNote ? <p className="form-error">{state.connectNote}</p> : null}
        <button type="button" className={`btn btn-solid${busy === "connect" ? " is-busy" : ""}`} disabled={busy !== null} onClick={startConnect}>
          {busy === "connect" ? "Working…" : state?.connectStatus === "complete" ? "Update payouts" : "Connect payouts"}
        </button>
      </section>

      <section className="studio-section">
        <h2>Custom domain</h2>
        {!state?.customDomainsEnabled ? (
          <p className="field-hint">
            {state?.customDomainNote ??
              "Custom domains are temporarily unavailable. Your studio subdomain still works."}
          </p>
        ) : !state?.canCustomDomain ? (
          <p className="field-hint">
            Custom domains are available on Growth and Studio (and during trial).
            Upgrade to edit this field on Starter.
          </p>
        ) : (
          <p className="field-hint">
            Use a subdomain (for example <code>photos.yourstudio.com</code>).
            Create a CNAME to{" "}
            <code>{state.expectedDnsTarget ?? "sites.studiofront.ca"}</code>,
            then save here. SSL usually finishes a few minutes after DNS
            propagates. Apex domains need ALIAS/ANAME at your registrar if they
            cannot CNAME.
          </p>
        )}
        {state?.customDomainsEnabled ? (
          <>
            <label className="field">
              <span>Domain</span>
              <input
                value={domain}
                onChange={(event) => setDomain(event.target.value)}
                placeholder="photos.yourstudio.com"
                disabled={!state?.canCustomDomain}
              />
            </label>
            {state?.canCustomDomain ? (
              <div
                className={`domain-status domain-status--${phase.key}`}
                role="status"
              >
                <div className="domain-status__head">
                  <strong>{phase.title}</strong>
                  {state.domain ? <code>{state.domain}</code> : null}
                </div>
                <p>{phase.detail}</p>
                <ul className="domain-status__checks">
                  <li data-ok={state.domainVerified ? "1" : "0"}>
                    DNS {state.domainVerified ? "verified" : "pending"}
                    {state.expectedDnsTarget ? (
                      <span className="muted"> → {state.expectedDnsTarget}</span>
                    ) : null}
                  </li>
                  <li
                    data-ok={
                      state.domainLive || state.domainSslStatus === "active"
                        ? "1"
                        : "0"
                    }
                  >
                    SSL{" "}
                    {state.domainLive || state.domainSslStatus === "active"
                      ? "active"
                      : state.domainSslStatus
                        ? state.domainSslStatus.replace(/_/g, " ")
                        : "pending"}
                  </li>
                </ul>
                {state.domain &&
                !state.domainLive &&
                state.domainStatus !== "active" ? (
                  <p className="field-hint domain-status__hint">
                    Propagation is often a few minutes; some registrars take longer.
                    This panel refreshes automatically while waiting.
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="domain-actions">
              <button
                type="button"
                className={`btn btn-outline${busy === "domain" ? " is-busy" : ""}`}
                disabled={busy !== null || !state?.canCustomDomain}
                onClick={saveDomain}
              >
                {busy === "domain" ? "Saving…" : "Save domain"}
              </button>
              {state?.canCustomDomain && state.domain ? (
                <button
                  type="button"
                  className={`btn btn-outline${busy === "domainCheck" ? " is-busy" : ""}`}
                  disabled={busy !== null}
                  onClick={checkDomainStatus}
                >
                  {busy === "domainCheck" ? "Checking…" : "Check status"}
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </section>

      <section className="studio-section">
        <h2>Team</h2>
        <p className="field-hint">
          Invite an editor by email. They get a link to join this studio and can
          manage orders, galleries, and site content — same day-to-day tools as
          you, without billing ownership. Seat limit follows your plan.
        </p>
        <label className="field">
          <span>Editor email</span>
          <input
            type="email"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="editor@studio.com"
            disabled={!canManageTeam}
          />
        </label>
        {canManageTeam ? (
          <button
            type="button"
            className={`btn btn-outline${busy === "invite" ? " is-busy" : ""}`}
            disabled={busy !== null}
            onClick={invite}
          >
            {busy === "invite" ? "Sending…" : "Send invite"}
          </button>
        ) : (
          <p className="field-hint">Only the studio owner can invite or remove team members.</p>
        )}
        {members.length > 0 ? (
          <>
            <p className="field-hint" style={{ marginTop: "0.75rem" }}>
              Team members
            </p>
            <ul className="settings-invite-list">
              {members.map((member) => (
                <li key={member.id}>
                  <div className="settings-invite-list__main">
                    <strong>{member.email}</strong>
                    <span className="muted">{member.role}</span>
                  </div>
                  {canManageTeam && member.role !== "owner" ? (
                    <button
                      type="button"
                      className="text-link"
                      disabled={busy !== null}
                      onClick={() => removeMember(member.id, member.email)}
                    >
                      {busy === `remove-member:${member.id}` ? "Removing…" : "Remove"}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {invites.length > 0 ? (
          <>
            <p className="field-hint" style={{ marginTop: "0.75rem" }}>
              Pending invites
            </p>
            <ul className="settings-invite-list">
              {invites.map((inviteRow) => (
                <li key={inviteRow.id}>
                  <div className="settings-invite-list__main">
                    <strong>{inviteRow.email}</strong>
                    <span className="muted">
                      {inviteRow.role} · pending
                    </span>
                  </div>
                  {canManageTeam ? (
                    <button
                      type="button"
                      className="text-link"
                      disabled={busy !== null}
                      onClick={() => cancelInvite(inviteRow.id, inviteRow.email)}
                    >
                      {busy === `remove-invite:${inviteRow.id}` ? "Cancelling…" : "Cancel"}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : members.length === 0 ? (
          <p className="field-hint">No team members yet.</p>
        ) : null}
      </section>

      <section className="studio-section">
        <h2>Refer a photographer</h2>
        <p className="field-hint">
          Share your link with another photographer. When they sign up, you both
          get an extra 30 days free on your trial.
        </p>
        {billing?.referralCode ? (
          <div className="field">
            <span>Your referral link</span>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <code
                style={{
                  flex: 1,
                  padding: "0.5rem",
                  background: "var(--bg-raised, #f5f5f5)",
                  borderRadius: "0.375rem",
                  fontSize: "0.85rem",
                  wordBreak: "break-all",
                }}
              >
                {`/signup?ref=${billing.referralCode}`}
              </code>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  const link = `${window.location.origin}/signup?ref=${billing.referralCode}`;
                  navigator.clipboard.writeText(link);
                  toastSuccess("Referral link copied.");
                }}
              >
                Copy
              </button>
            </div>
          </div>
        ) : (
          <p className="field-hint">
            Referral link is not ready yet on this server. Run the referral migration
            and reload Settings.
          </p>
        )}
      </section>

      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
