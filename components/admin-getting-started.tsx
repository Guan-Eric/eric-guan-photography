"use client";

import Link from "next/link";
import { useState } from "react";
import { toastError, toastSuccess } from "@/lib/toast";

const STEPS = [
  {
    href: "/admin/work",
    title: "Add your portfolio",
    body: "Upload a hero and a few listing photos so agents see real work.",
  },
  {
    href: "/admin/schedule",
    title: "Set your hours",
    body: "Weekly availability drives the booking form.",
  },
  {
    href: "/admin/settings",
    title: "Connect payouts",
    body: "Stripe Connect lets agents pay you in-gallery.",
  },
  {
    href: "/admin/pricing",
    title: "Confirm packages",
    body: "Edit prices and sq ft bands before you share the book link.",
  },
] as const;

export function AdminGettingStarted({
  bookingUrl,
  welcome = false,
  plan = null,
}: {
  bookingUrl: string;
  welcome?: boolean;
  plan?: string | null;
}) {
  const [hidden, setHidden] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const showPlanCheckout =
    plan === "payg" ||
    plan === "starter" ||
    plan === "growth" ||
    plan === "studio";

  if (hidden || !welcome) return null;

  async function startCheckout() {
    if (!showPlanCheckout || !plan) return;
    setBillingBusy(true);
    setBillingError(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const json = await response.json();
      if (!json.ok) {
        const message = json.error ?? "Could not start checkout.";
        setBillingError(message);
        toastError(message);
        return;
      }
      if (json.url) {
        toastSuccess("Opening checkout…");
        window.location.href = json.url;
        return;
      }
      const fallback =
        "Billing is not configured yet — you can start your trial from Settings.";
      setBillingError(fallback);
      toastError(fallback);
    } catch {
      setBillingError("Network error.");
      toastError("Network error.");
    } finally {
      setBillingBusy(false);
    }
  }

  return (
    <section className="admin-getting-started">
      <div className="admin-getting-started-head">
        <div>
          <p className="eyebrow">Welcome</p>
          <h2>Get your studio ready</h2>
          <p>Four quick steps before you send agents to book.</p>
        </div>
        <button type="button" className="text-link" onClick={() => setHidden(true)}>
          Dismiss
        </button>
      </div>
      <ol className="admin-getting-started-list">
        {STEPS.map((step) => (
          <li key={step.href}>
            <Link href={step.href}>
              <strong>{step.title}</strong>
              <span>{step.body}</span>
            </Link>
          </li>
        ))}
      </ol>
      <div className="admin-getting-started-actions">
        <a className="btn btn-solid" href={bookingUrl} target="_blank" rel="noreferrer">
          Preview booking page
        </a>
        {showPlanCheckout ? (
          <button
            type="button"
            className={`btn btn-outline${billingBusy ? " is-busy" : ""}`}
            disabled={billingBusy}
            onClick={() => void startCheckout()}
          >
            {billingBusy ? "Opening…" : `Continue with ${plan} plan`}
          </button>
        ) : null}
      </div>
      {billingError ? <p className="form-error">{billingError}</p> : null}
    </section>
  );
}
