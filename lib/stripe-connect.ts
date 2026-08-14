import { getStripe } from "@/lib/stripe";
import { getTenantRow, updateTenantConnect } from "@/lib/tenant-store";

export function connectEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export async function ensureConnectAccount(tenantId: string, email: string) {
  const stripe = getStripe();
  if (!stripe) {
    return {
      ok: false as const,
      stubbed: true as const,
      error: "Stripe not configured. Set STRIPE_SECRET_KEY to enable Connect.",
    };
  }

  const row = getTenantRow(tenantId);
  if (!row) return { ok: false as const, error: "Tenant not found." };

  if (row.stripeConnectAccountId) {
    return {
      ok: true as const,
      accountId: row.stripeConnectAccountId,
      status: row.stripeConnectStatus,
    };
  }

  const account = await stripe.accounts.create({
    type: "express",
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { tenantId },
  });

  updateTenantConnect(tenantId, {
    accountId: account.id,
    status: "pending",
  });

  return { ok: true as const, accountId: account.id, status: "pending" as const };
}

export async function createConnectOnboardingLink(options: {
  tenantId: string;
  email: string;
  returnUrl: string;
  refreshUrl: string;
}) {
  const ensured = await ensureConnectAccount(options.tenantId, options.email);
  if (!ensured.ok) return ensured;

  const stripe = getStripe();
  if (!stripe || !("accountId" in ensured)) {
    return {
      ok: false as const,
      stubbed: true as const,
      error: "Stripe not configured.",
    };
  }

  const link = await stripe.accountLinks.create({
    account: ensured.accountId,
    refresh_url: options.refreshUrl,
    return_url: options.returnUrl,
    type: "account_onboarding",
  });

  return { ok: true as const, url: link.url, accountId: ensured.accountId };
}

export async function refreshConnectStatus(tenantId: string) {
  const stripe = getStripe();
  const row = getTenantRow(tenantId);
  if (!stripe || !row?.stripeConnectAccountId) {
    return { ok: false as const, error: "Connect not started." };
  }

  const account = await stripe.accounts.retrieve(row.stripeConnectAccountId);
  const status =
    account.charges_enabled && account.details_submitted
      ? "complete"
      : account.requirements?.disabled_reason
        ? "restricted"
        : "pending";

  updateTenantConnect(tenantId, {
    accountId: account.id,
    status,
  });

  return { ok: true as const, status, accountId: account.id };
}
