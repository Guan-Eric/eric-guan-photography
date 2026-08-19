import { getStripe } from "@/lib/stripe";
import { getTenantRow, updateTenantConnect } from "@/lib/tenant-store";

export const CONNECT_MODE_MISMATCH_NOTE =
  "Payouts were connected in a different Stripe mode (test vs live). Connect payouts again to receive payments with the current keys.";

export function connectEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function isUnusableConnectAccountError(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error ?? "");
  return /testmode key|livemode key|can only be used with|No such account/i.test(
    message,
  );
}

async function clearConnectAccount(tenantId: string) {
  await updateTenantConnect(tenantId, {
    accountId: null,
    status: "not_started",
  });
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

  const row = await getTenantRow(tenantId);
  if (!row) return { ok: false as const, error: "Tenant not found." };

  if (row.stripeConnectAccountId) {
    try {
      await stripe.accounts.retrieve(row.stripeConnectAccountId);
      return {
        ok: true as const,
        accountId: row.stripeConnectAccountId,
        status: row.stripeConnectStatus,
      };
    } catch (error) {
      if (!isUnusableConnectAccountError(error)) {
        return {
          ok: false as const,
          error:
            error instanceof Error
              ? error.message
              : "Could not load the Stripe Connect account.",
        };
      }
      await clearConnectAccount(tenantId);
    }
  }

  try {
    const account = await stripe.accounts.create({
      type: "express",
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { tenantId },
    });

    await updateTenantConnect(tenantId, {
      accountId: account.id,
      status: "pending",
    });

    return { ok: true as const, accountId: account.id, status: "pending" as const };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Could not create a Stripe Connect account.",
    };
  }
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

  try {
    const link = await stripe.accountLinks.create({
      account: ensured.accountId,
      refresh_url: options.refreshUrl,
      return_url: options.returnUrl,
      type: "account_onboarding",
    });

    return { ok: true as const, url: link.url, accountId: ensured.accountId };
  } catch (error) {
    if (isUnusableConnectAccountError(error)) {
      await clearConnectAccount(options.tenantId);
      return {
        ok: false as const,
        error: CONNECT_MODE_MISMATCH_NOTE,
      };
    }
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Could not start Stripe Connect onboarding.",
    };
  }
}

export async function refreshConnectStatus(tenantId: string) {
  const stripe = getStripe();
  const row = await getTenantRow(tenantId);
  if (!stripe || !row?.stripeConnectAccountId) {
    return { ok: false as const, error: "Connect not started." };
  }

  try {
    const account = await stripe.accounts.retrieve(row.stripeConnectAccountId);
    const status =
      account.charges_enabled && account.details_submitted
        ? "complete"
        : account.requirements?.disabled_reason
          ? "restricted"
          : "pending";

    await updateTenantConnect(tenantId, {
      accountId: account.id,
      status,
    });

    return { ok: true as const, status, accountId: account.id };
  } catch (error) {
    if (isUnusableConnectAccountError(error)) {
      await clearConnectAccount(tenantId);
      return {
        ok: true as const,
        status: "not_started" as const,
        accountId: null,
        reset: true as const,
        note: CONNECT_MODE_MISMATCH_NOTE,
      };
    }
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Could not refresh Connect status.",
    };
  }
}
