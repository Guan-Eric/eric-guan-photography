import { eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import type Stripe from "stripe";
import { getDb, qAll, qRun, schema } from "@/lib/db";
import type { PlanId, SubscriptionStatus, TenantRow } from "@/lib/db/schema";
import {
  DOMAIN_ADDON_USD,
  PLAN_DEFS,
  entitlements,
} from "@/lib/plan-defs";
import { platformName, platformPublicUrl } from "@/lib/platform";
import { getStripe, stripeEnabled } from "@/lib/stripe";
import { getTenantRow } from "@/lib/tenant-store";

export type { PlanDef } from "@/lib/plan-defs";
export { DOMAIN_ADDON_USD, PLAN_DEFS, entitlements };

const id = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 14);

/** Meter event name configured on the Stripe billing meter. */
export function listingMeterEvent() {
  return process.env.STRIPE_METER_EVENT_LISTINGS?.trim() || "listing_completed";
}

export function meteredPriceIdForPlan(plan: PlanId) {
  const env = PLAN_DEFS[plan].envMeteredPrice;
  if (!env) return "";
  return process.env[env] ?? "";
}

/** Metering is live only when the plan has a configured metered price. */
export function meteringEnabled(plan: PlanId) {
  return Boolean(meteredPriceIdForPlan(plan));
}

const TRIAL_DAYS = 14;

function nowIso() {
  return new Date().toISOString();
}

export function trialEndsAt(from = new Date()) {
  return new Date(from.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function hasActiveAccess(row: TenantRow) {
  if (row.subscriptionStatus === "active") return true;
  if (row.subscriptionStatus === "trialing") {
    if (!row.trialEndsAt) return true;
    return new Date(row.trialEndsAt).getTime() > Date.now();
  }
  if (row.plan === "trial" && row.trialEndsAt) {
    return new Date(row.trialEndsAt).getTime() > Date.now();
  }
  return false;
}

async function resetYearIfNeeded(row: TenantRow) {
  const year = new Date().getUTCFullYear();
  if (row.listingsYear === year) return row;
  const db = getDb();
  await qRun(
    db
      .update(schema.tenants)
      .set({
        listingsUsedYear: 0,
        listingsYear: year,
        updatedAt: nowIso(),
      })
      .where(eq(schema.tenants.id, row.id)),
  );
  return (await getTenantRow(row.id))!;
}

/**
 * Quotas no longer hard-block at the cap: past the included listings we meter
 * the overage. Access is only refused when billing itself is unhealthy.
 */
export async function assertCanCreateListing(tenantId: string) {
  const row = await getTenantRow(tenantId);
  if (!row) return { ok: false as const, error: "Studio not found." };
  const current = await resetYearIfNeeded(row);
  if (!hasActiveAccess(current)) {
    return {
      ok: false as const,
      error: "Your trial or subscription is inactive. Choose a plan in Settings to keep booking.",
    };
  }
  if (
    current.listingsUsedYear >= current.listingQuotaAnnual &&
    !meteringEnabled(current.plan)
  ) {
    return {
      ok: false as const,
      error: `Annual listing quota reached (${current.listingQuotaAnnual}). Upgrade your plan.`,
    };
  }
  return { ok: true as const, row: current };
}

/** Listings past the included quota (all of them on payg) are metered. */
export function listingIsMetered(row: TenantRow) {
  if (!meteringEnabled(row.plan)) return false;
  return row.listingsUsedYear >= row.listingQuotaAnnual;
}

export async function incrementListingUsage(tenantId: string) {
  const row = await getTenantRow(tenantId);
  if (!row) return;
  const current = await resetYearIfNeeded(row);
  const db = getDb();
  await qRun(
    db
      .update(schema.tenants)
      .set({
        listingsUsedYear: current.listingsUsedYear + 1,
        updatedAt: nowIso(),
      })
      .where(eq(schema.tenants.id, tenantId)),
  );

  if (listingIsMetered(current)) {
    await reportListingUsage(current);
  }
}

/**
 * Push one metered listing to Stripe. Every attempt is journaled to
 * billing_events so an invoice can be reconciled against the board.
 */
export async function reportListingUsage(row: TenantRow) {
  const stripe = getStripe();
  if (!stripe || !row.stripeCustomerId) {
    await recordBillingEvent({
      tenantId: row.id,
      type: "usage.listing.skipped",
      payload: {
        plan: row.plan,
        reason: stripe ? "no_customer" : "stripe_disabled",
        listingsUsedYear: row.listingsUsedYear,
      },
    });
    return { ok: false as const, skipped: true as const };
  }

  try {
    await stripe.billing.meterEvents.create({
      event_name: listingMeterEvent(),
      payload: {
        stripe_customer_id: row.stripeCustomerId,
        value: "1",
      },
    });
    await recordBillingEvent({
      tenantId: row.id,
      type: "usage.listing.reported",
      payload: {
        plan: row.plan,
        event: listingMeterEvent(),
        listingsUsedYear: row.listingsUsedYear,
        unitUsd: PLAN_DEFS[row.plan].meteredUsd,
      },
    });
    return { ok: true as const };
  } catch (error) {
    await recordBillingEvent({
      tenantId: row.id,
      type: "usage.listing.failed",
      payload: {
        plan: row.plan,
        error: error instanceof Error ? error.message : "meter event failed",
      },
    });
    return { ok: false as const, error: "Could not report usage." };
  }
}

export async function assertCanInviteSeat(tenantId: string) {
  const row = await getTenantRow(tenantId);
  if (!row) return { ok: false as const, error: "Studio not found." };
  const db = getDb();
  const seats = (
    await qAll(db.select().from(schema.memberships).where(eq(schema.memberships.tenantId, tenantId)))
  ).length;
  const pending = (
    await qAll<{ acceptedAt: string | null }>(
      db
        .select()
        .from(schema.membershipInvites)
        .where(eq(schema.membershipInvites.tenantId, tenantId)),
    )
  ).filter((invite) => !invite.acceptedAt).length;
  if (seats + pending >= row.seatsQuota) {
    return {
      ok: false as const,
      error: `Seat limit reached (${row.seatsQuota}). Upgrade to invite more editors.`,
    };
  }
  return { ok: true as const, row };
}

export function priceIdForPlan(plan: Exclude<PlanId, "trial">) {
  return process.env[PLAN_DEFS[plan].envPrice] ?? "";
}

/**
 * Base prices only — the overage price is shared by every flat tier, so it
 * cannot identify a plan.
 */
export function planFromPriceId(priceId: string | undefined): PlanId | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PAYG_BASE) return "payg";
  if (priceId === process.env.STRIPE_PRICE_STARTER) return "starter";
  if (priceId === process.env.STRIPE_PRICE_GROWTH) return "growth";
  if (priceId === process.env.STRIPE_PRICE_STUDIO) return "studio";
  return null;
}

export async function applyPlanToTenant(
  tenantId: string,
  plan: PlanId,
  options?: {
    status?: SubscriptionStatus;
    customerId?: string;
    subscriptionId?: string;
    trialEndsAt?: string | null;
  },
) {
  const def = PLAN_DEFS[plan];
  const db = getDb();
  await qRun(
    db
      .update(schema.tenants)
      .set({
        plan,
        subscriptionStatus: options?.status ?? (plan === "trial" ? "trialing" : "active"),
        ...(options?.customerId ? { stripeCustomerId: options.customerId } : {}),
        ...(options?.subscriptionId
          ? { stripeSubscriptionId: options.subscriptionId }
          : {}),
        trialEndsAt: options?.trialEndsAt,
        listingQuotaAnnual: def.listingQuota,
        seatsQuota: def.seats,
        mediaQuotaBytes: def.storageBytes,
        updatedAt: nowIso(),
      })
      .where(eq(schema.tenants.id, tenantId)),
  );
}

export async function recordBillingEvent(options: {
  tenantId: string;
  type: string;
  stripeId?: string | null;
  payload?: unknown;
}) {
  const db = getDb();
  await qRun(
    db.insert(schema.billingEvents).values({
      id: `bev_${id()}`,
      tenantId: options.tenantId,
      type: options.type,
      stripeId: options.stripeId ?? null,
      payloadJson: JSON.stringify(options.payload ?? {}),
      createdAt: nowIso(),
    }),
  );
}

async function ensureCustomer(row: TenantRow, email: string) {
  const stripe = getStripe();
  if (!stripe) return { ok: false as const, stubbed: true as const };
  if (row.stripeCustomerId) {
    return { ok: true as const, customerId: row.stripeCustomerId };
  }
  const customer = await stripe.customers.create({
    email,
    metadata: { tenantId: row.id },
    name: row.slug,
  });
  const db = getDb();
  await qRun(
    db
      .update(schema.tenants)
      .set({ stripeCustomerId: customer.id, updatedAt: nowIso() })
      .where(eq(schema.tenants.id, row.id)),
  );
  return { ok: true as const, customerId: customer.id };
}

export async function createSubscriptionCheckout(options: {
  tenantId: string;
  plan: Exclude<PlanId, "trial">;
  email: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const row = await getTenantRow(options.tenantId);
  if (!row) return { ok: false as const, error: "Studio not found." };

  if (!stripeEnabled()) {
    await applyPlanToTenant(options.tenantId, options.plan, { status: "active" });
    await recordBillingEvent({
      tenantId: options.tenantId,
      type: "local_stub.plan",
      payload: { plan: options.plan },
    });
    return { ok: true as const, stubbed: true as const, plan: options.plan };
  }

  const priceId = priceIdForPlan(options.plan);
  if (!priceId) {
    return {
      ok: false as const,
      error: `Missing ${PLAN_DEFS[options.plan].envPrice} in the environment.`,
    };
  }

  const stripe = getStripe()!;
  const customer = await ensureCustomer(row, options.email);
  if (!customer.ok || !("customerId" in customer)) {
    return { ok: false as const, error: "Could not create Stripe customer." };
  }

  const stillTrialing =
    row.trialEndsAt && new Date(row.trialEndsAt).getTime() > Date.now();

  // Metered items carry no quantity; usage arrives via meter events.
  const meteredPriceId = meteredPriceIdForPlan(options.plan);
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: priceId, quantity: 1 },
  ];
  if (meteredPriceId) lineItems.push({ price: meteredPriceId });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customer.customerId,
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
    line_items: lineItems,
    metadata: {
      kind: "subscription",
      tenantId: options.tenantId,
      plan: options.plan,
    },
    subscription_data: {
      metadata: { kind: "subscription", tenantId: options.tenantId, plan: options.plan },
      ...(stillTrialing
        ? { trial_end: Math.floor(new Date(row.trialEndsAt!).getTime() / 1000) }
        : {}),
    },
  });

  return {
    ok: true as const,
    stubbed: false as const,
    url: session.url,
    sessionId: session.id,
  };
}

export async function createBillingPortalSession(tenantId: string, returnUrl: string) {
  const row = await getTenantRow(tenantId);
  if (!row?.stripeCustomerId) {
    return { ok: false as const, error: "No billing customer yet. Choose a plan first." };
  }
  const stripe = getStripe();
  if (!stripe) {
    return { ok: false as const, stubbed: true as const, error: "Stripe not configured." };
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: row.stripeCustomerId,
    return_url: returnUrl,
  });
  return { ok: true as const, url: session.url };
}

export async function applyStripeSubscription(sub: Stripe.Subscription) {
  const tenantId = sub.metadata?.tenantId;
  if (!tenantId) return { ok: false as const, error: "No tenant on subscription." };
  const plan =
    sub.items.data
      .map((item) => planFromPriceId(item.price?.id))
      .find((match): match is PlanId => Boolean(match)) ??
    (sub.metadata?.plan as PlanId | undefined);
  if (!plan || plan === "trial") {
    return { ok: false as const, error: "Unknown plan price." };
  }
  const status = (sub.status as SubscriptionStatus) ?? "active";
  await applyPlanToTenant(tenantId, plan, {
    status: status === "trialing" ? "trialing" : status,
    customerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    subscriptionId: sub.id,
    trialEndsAt: sub.trial_end
      ? new Date(sub.trial_end * 1000).toISOString()
      : null,
  });
  await recordBillingEvent({
    tenantId,
    type: `subscription.${sub.status}`,
    stripeId: sub.id,
    payload: { plan, status },
  });
  return { ok: true as const, tenantId, plan };
}

export function billingSummary(row: TenantRow, options?: { activeDomains?: number }) {
  const access = hasActiveAccess(row);
  const plan = row.plan;
  const def = PLAN_DEFS[plan];
  const meteredListings = Math.max(0, row.listingsUsedYear - row.listingQuotaAnnual);
  const metered = meteringEnabled(plan);
  const activeDomains = options?.activeDomains ?? 0;
  const domainUsd = activeDomains * DOMAIN_ADDON_USD;

  return {
    plan,
    planLabel: def.label,
    monthlyUsd: def.monthlyUsd,
    subscriptionStatus: row.subscriptionStatus,
    trialEndsAt: row.trialEndsAt,
    listingQuotaAnnual: row.listingQuotaAnnual,
    listingsUsedYear: row.listingsUsedYear,
    seatsQuota: row.seatsQuota,
    hasAccess: access,
    entitlements: entitlements(plan),
    platformName: platformName(),
    billingReturn: `${platformPublicUrl()}/admin/settings`,
    metering: {
      enabled: metered,
      unitUsd: def.meteredUsd,
      meteredListings: metered ? meteredListings : 0,
      meteredUsd: metered ? meteredListings * def.meteredUsd : 0,
    },
    domains: {
      active: activeDomains,
      unitUsd: DOMAIN_ADDON_USD,
      monthlyUsd: domainUsd,
    },
    projectedMonthlyUsd:
      def.monthlyUsd +
      domainUsd +
      (metered ? meteredListings * def.meteredUsd : 0),
  };
}
