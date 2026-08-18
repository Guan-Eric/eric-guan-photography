import { afterEach, describe, expect, it } from "vitest";
import {
  DOMAIN_ADDON_USD,
  PLAN_DEFS,
  billingSummary,
  entitlements,
  hasActiveAccess,
  listingIsMetered,
  listingMeterEvent,
  meteringEnabled,
  planFromPriceId,
  trialEndsAt,
} from "@/lib/billing";
import type { TenantRow } from "@/lib/db/schema";

function row(partial: Partial<TenantRow>): TenantRow {
  return {
    id: "t1",
    slug: "t1",
    domain: null,
    domainCfId: null,
    domainStatus: null,
    timezone: "America/Toronto",
    configJson: "{}",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    plan: "trial",
    subscriptionStatus: "trialing",
    trialEndsAt: null,
    listingQuotaAnnual: 100,
    seatsQuota: 1,
    listingsUsedYear: 0,
    listingsYear: 2026,
    stripeConnectAccountId: null,
    stripeConnectStatus: "not_started",
    storageBytesUsed: 0,
    mediaQuotaBytes: 10_000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

describe("billing entitlements & access", () => {
  it("exposes plan quotas", () => {
    expect(PLAN_DEFS.starter.listingQuota).toBe(125);
    expect(PLAN_DEFS.growth.listingQuota).toBe(250);
    expect(PLAN_DEFS.studio.monthlyUsd).toBe(149);
    expect(PLAN_DEFS.studio.seats).toBe(5);
  });

  it("gates features by plan", () => {
    expect(entitlements("starter").propertyPages).toBe(false);
    expect(entitlements("trial").propertyPages).toBe(true);
    expect(entitlements("growth").propertyPages).toBe(true);
    expect(entitlements("studio").shareKit).toBe(true);
    expect(entitlements("growth").shareKit).toBe(false);
    expect(entitlements("trial").customDomain).toBe(true);
    expect(entitlements("starter").customDomain).toBe(false);
  });

  it("trialEndsAt is ~14 days out", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const ends = new Date(trialEndsAt(from));
    expect(ends.getTime() - from.getTime()).toBe(14 * 24 * 60 * 60 * 1000);
  });

  it("pay-as-you-go carries every feature", () => {
    expect(PLAN_DEFS.payg.monthlyUsd).toBe(0);
    expect(PLAN_DEFS.payg.listingQuota).toBe(0);
    expect(PLAN_DEFS.payg.meteredUsd).toBe(5);
    const access = entitlements("payg");
    expect(access.propertyPages).toBe(true);
    expect(access.shareKit).toBe(true);
    expect(access.customDomain).toBe(true);
  });

  it("hasActiveAccess for active / trialing / trial plan", () => {
    expect(hasActiveAccess(row({ subscriptionStatus: "active" }))).toBe(true);
    expect(
      hasActiveAccess(
        row({
          subscriptionStatus: "trialing",
          trialEndsAt: new Date(Date.now() + 86_400_000).toISOString(),
        }),
      ),
    ).toBe(true);
    expect(
      hasActiveAccess(
        row({
          subscriptionStatus: "canceled",
          plan: "trial",
          trialEndsAt: new Date(Date.now() - 86_400_000).toISOString(),
        }),
      ),
    ).toBe(false);
  });
});

describe("metered listings", () => {
  const priceEnv = [
    "STRIPE_PRICE_PAYG_BASE",
    "STRIPE_PRICE_PAYG_LISTING",
    "STRIPE_PRICE_OVERAGE_LISTING",
    "STRIPE_METER_EVENT_LISTINGS",
  ] as const;

  afterEach(() => {
    for (const key of priceEnv) delete process.env[key];
  });

  it("stays off until a metered price is configured", () => {
    expect(meteringEnabled("studio")).toBe(false);
    process.env.STRIPE_PRICE_OVERAGE_LISTING = "price_over";
    expect(meteringEnabled("studio")).toBe(true);
    expect(meteringEnabled("trial")).toBe(false);
  });

  it("meters only past the included quota on flat tiers", () => {
    process.env.STRIPE_PRICE_OVERAGE_LISTING = "price_over";
    const under = row({ plan: "starter", listingQuotaAnnual: 100, listingsUsedYear: 99 });
    const over = row({ plan: "starter", listingQuotaAnnual: 100, listingsUsedYear: 100 });
    expect(listingIsMetered(under)).toBe(false);
    expect(listingIsMetered(over)).toBe(true);
  });

  it("meters every listing on payg", () => {
    process.env.STRIPE_PRICE_PAYG_LISTING = "price_payg_listing";
    const first = row({ plan: "payg", listingQuotaAnnual: 0, listingsUsedYear: 0 });
    expect(listingIsMetered(first)).toBe(true);
  });

  it("defaults the meter event name and allows an override", () => {
    expect(listingMeterEvent()).toBe("listing_completed");
    process.env.STRIPE_METER_EVENT_LISTINGS = "shoots";
    expect(listingMeterEvent()).toBe("shoots");
  });

  it("maps base prices to plans and ignores the shared overage price", () => {
    process.env.STRIPE_PRICE_PAYG_BASE = "price_payg";
    process.env.STRIPE_PRICE_OVERAGE_LISTING = "price_over";
    expect(planFromPriceId("price_payg")).toBe("payg");
    expect(planFromPriceId("price_over")).toBeNull();
  });

  it("projects the monthly total from base, overage and domains", () => {
    process.env.STRIPE_PRICE_OVERAGE_LISTING = "price_over";
    const summary = billingSummary(
      row({ plan: "growth", listingQuotaAnnual: 250, listingsUsedYear: 254 }),
      { activeDomains: 2 },
    );
    expect(summary.metering.meteredListings).toBe(4);
    expect(summary.metering.meteredUsd).toBe(12);
    expect(summary.domains.monthlyUsd).toBe(2 * DOMAIN_ADDON_USD);
    expect(summary.projectedMonthlyUsd).toBe(99 + 12 + 2 * DOMAIN_ADDON_USD);
  });
});
