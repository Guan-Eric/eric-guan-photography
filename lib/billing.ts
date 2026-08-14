import { eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import type Stripe from "stripe";
import { getDb, schema } from "@/lib/db";
import type { PlanId, SubscriptionStatus, TenantRow } from "@/lib/db/schema";
import { platformName, platformPublicUrl } from "@/lib/platform";
import { getStripe, stripeEnabled } from "@/lib/stripe";
import { getTenantRow } from "@/lib/tenant-store";

const id = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 14);

export const PLAN_DEFS: Record<
  PlanId,
  {
    label: string;
    monthlyUsd: number;
    listingQuota: number;
    seats: number;
    storageBytes: number;
    envPrice: string;
  }
> = {
  trial: {
    label: "Trial",
    monthlyUsd: 0,
    listingQuota: 100,
    seats: 1,
    storageBytes: 10_737_418_240,
    envPrice: "",
  },
  starter: {
    label: "Starter",
    monthlyUsd: 49,
    listingQuota: 100,
    seats: 1,
    storageBytes: 21_474_836_480,
    envPrice: "STRIPE_PRICE_STARTER",
  },
  growth: {
    label: "Growth",
    monthlyUsd: 99,
    listingQuota: 250,
    seats: 3,
    storageBytes: 53_687_091_200,
    envPrice: "STRIPE_PRICE_GROWTH",
  },
  studio: {
    label: "Studio",
    monthlyUsd: 179,
    listingQuota: 500,
    seats: 5,
    storageBytes: 107_374_182_400,
    envPrice: "STRIPE_PRICE_STUDIO",
  },
};

const TRIAL_DAYS = 14;

function nowIso() {
  return new Date().toISOString();
}

export function trialEndsAt(from = new Date()) {
  return new Date(from.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function entitlements(plan: PlanId) {
  return {
    customDomain: plan === "growth" || plan === "studio",
    propertyPages: plan === "growth" || plan === "studio",
    shareKit: plan === "studio",
    reports: plan === "studio",
    upsells: plan === "studio",
  };
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

function resetYearIfNeeded(row: TenantRow) {
  const year = new Date().getUTCFullYear();
  if (row.listingsYear === year) return row;
  const db = getDb();
  db.update(schema.tenants)
    .set({
      listingsUsedYear: 0,
      listingsYear: year,
      updatedAt: nowIso(),
    })
    .where(eq(schema.tenants.id, row.id))
    .run();
  return getTenantRow(row.id)!;
}

export function assertCanCreateListing(tenantId: string) {
  const row = getTenantRow(tenantId);
  if (!row) return { ok: false as const, error: "Studio not found." };
  const current = resetYearIfNeeded(row);
  if (!hasActiveAccess(current)) {
    return {
      ok: false as const,
      error: "Your trial or subscription is inactive. Choose a plan in Settings to keep booking.",
    };
  }
  if (current.listingsUsedYear >= current.listingQuotaAnnual) {
    return {
      ok: false as const,
      error: `Annual listing quota reached (${current.listingQuotaAnnual}). Upgrade your plan.`,
    };
  }
  return { ok: true as const, row: current };
}

export function incrementListingUsage(tenantId: string) {
  const row = getTenantRow(tenantId);
  if (!row) return;
  const current = resetYearIfNeeded(row);
  const db = getDb();
  db.update(schema.tenants)
    .set({
      listingsUsedYear: current.listingsUsedYear + 1,
      updatedAt: nowIso(),
    })
    .where(eq(schema.tenants.id, tenantId))
    .run();
}

export function assertCanInviteSeat(tenantId: string) {
  const row = getTenantRow(tenantId);
  if (!row) return { ok: false as const, error: "Studio not found." };
  const db = getDb();
  const seats = db
    .select()
    .from(schema.memberships)
    .where(eq(schema.memberships.tenantId, tenantId))
    .all().length;
  const pending = db
    .select()
    .from(schema.membershipInvites)
    .where(eq(schema.membershipInvites.tenantId, tenantId))
    .all()
    .filter((invite) => !invite.acceptedAt).length;
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

export function planFromPriceId(priceId: string | undefined): PlanId | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_STARTER) return "starter";
  if (priceId === process.env.STRIPE_PRICE_GROWTH) return "growth";
  if (priceId === process.env.STRIPE_PRICE_STUDIO) return "studio";
  return null;
}

export function applyPlanToTenant(
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
  db.update(schema.tenants)
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
    .where(eq(schema.tenants.id, tenantId))
    .run();
}

export function recordBillingEvent(options: {
  tenantId: string;
  type: string;
  stripeId?: string | null;
  payload?: unknown;
}) {
  const db = getDb();
  db.insert(schema.billingEvents)
    .values({
      id: `bev_${id()}`,
      tenantId: options.tenantId,
      type: options.type,
      stripeId: options.stripeId ?? null,
      payloadJson: JSON.stringify(options.payload ?? {}),
      createdAt: nowIso(),
    })
    .run();
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
  db.update(schema.tenants)
    .set({ stripeCustomerId: customer.id, updatedAt: nowIso() })
    .where(eq(schema.tenants.id, row.id))
    .run();
  return { ok: true as const, customerId: customer.id };
}

export async function createSubscriptionCheckout(options: {
  tenantId: string;
  plan: Exclude<PlanId, "trial">;
  email: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const row = getTenantRow(options.tenantId);
  if (!row) return { ok: false as const, error: "Studio not found." };

  if (!stripeEnabled()) {
    applyPlanToTenant(options.tenantId, options.plan, { status: "active" });
    recordBillingEvent({
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

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customer.customerId,
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
    line_items: [{ price: priceId, quantity: 1 }],
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
  const row = getTenantRow(tenantId);
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

export function applyStripeSubscription(sub: Stripe.Subscription) {
  const tenantId = sub.metadata?.tenantId;
  if (!tenantId) return { ok: false as const, error: "No tenant on subscription." };
  const priceId = sub.items.data[0]?.price?.id;
  const plan = planFromPriceId(priceId) ?? (sub.metadata?.plan as PlanId | undefined);
  if (!plan || plan === "trial") {
    return { ok: false as const, error: "Unknown plan price." };
  }
  const status = (sub.status as SubscriptionStatus) ?? "active";
  applyPlanToTenant(tenantId, plan, {
    status: status === "trialing" ? "trialing" : status,
    customerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    subscriptionId: sub.id,
    trialEndsAt: sub.trial_end
      ? new Date(sub.trial_end * 1000).toISOString()
      : null,
  });
  recordBillingEvent({
    tenantId,
    type: `subscription.${sub.status}`,
    stripeId: sub.id,
    payload: { plan, status },
  });
  return { ok: true as const, tenantId, plan };
}

export function billingSummary(row: TenantRow) {
  const access = hasActiveAccess(row);
  const plan = row.plan;
  return {
    plan,
    planLabel: PLAN_DEFS[plan].label,
    monthlyUsd: PLAN_DEFS[plan].monthlyUsd,
    subscriptionStatus: row.subscriptionStatus,
    trialEndsAt: row.trialEndsAt,
    listingQuotaAnnual: row.listingQuotaAnnual,
    listingsUsedYear: row.listingsUsedYear,
    seatsQuota: row.seatsQuota,
    hasAccess: access,
    entitlements: entitlements(plan),
    platformName: platformName(),
    billingReturn: `${platformPublicUrl()}/admin/settings`,
  };
}
