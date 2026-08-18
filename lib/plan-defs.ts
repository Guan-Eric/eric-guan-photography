import type { PlanId } from "@/lib/db/schema";

export type PlanDef = {
  label: string;
  monthlyUsd: number;
  /** Listings included before metered usage starts. */
  listingQuota: number;
  seats: number;
  storageBytes: number;
  envPrice: string;
  /** Metered price for listings beyond the included quota (or every listing on payg). */
  envMeteredPrice: string;
  /** Per-listing price in dollars once metering kicks in. */
  meteredUsd: number;
};

export const PLAN_DEFS: Record<PlanId, PlanDef> = {
  trial: {
    label: "Trial",
    monthlyUsd: 0,
    listingQuota: 100,
    seats: 1,
    storageBytes: 10_737_418_240,
    envPrice: "",
    envMeteredPrice: "",
    meteredUsd: 0,
  },
  payg: {
    label: "Pay as you go",
    monthlyUsd: 0,
    listingQuota: 0,
    seats: 1,
    storageBytes: 21_474_836_480,
    envPrice: "STRIPE_PRICE_PAYG_BASE",
    envMeteredPrice: "STRIPE_PRICE_PAYG_LISTING",
    meteredUsd: 5,
  },
  starter: {
    label: "Starter",
    monthlyUsd: 49,
    listingQuota: 125,
    seats: 1,
    storageBytes: 21_474_836_480,
    envPrice: "STRIPE_PRICE_STARTER",
    envMeteredPrice: "STRIPE_PRICE_OVERAGE_LISTING",
    meteredUsd: 3,
  },
  growth: {
    label: "Growth",
    monthlyUsd: 99,
    listingQuota: 250,
    seats: 3,
    storageBytes: 53_687_091_200,
    envPrice: "STRIPE_PRICE_GROWTH",
    envMeteredPrice: "STRIPE_PRICE_OVERAGE_LISTING",
    meteredUsd: 3,
  },
  studio: {
    label: "Studio",
    monthlyUsd: 149,
    listingQuota: 500,
    seats: 5,
    storageBytes: 107_374_182_400,
    envPrice: "STRIPE_PRICE_STUDIO",
    envMeteredPrice: "STRIPE_PRICE_OVERAGE_LISTING",
    meteredUsd: 3,
  },
};

/** Per-month price for each active custom hostname on a studio. */
export const DOMAIN_ADDON_USD = 5;

/**
 * Pay-as-you-go carries every feature because each listing is billed; the flat
 * tiers gate features and get cheaper per listing as volume grows.
 */
export function entitlements(plan: PlanId) {
  if (plan === "payg") {
    return {
      customDomain: true,
      propertyPages: true,
      shareKit: true,
      reports: true,
      upsells: true,
    };
  }
  return {
    customDomain: plan === "trial" || plan === "growth" || plan === "studio",
    propertyPages: plan === "trial" || plan === "growth" || plan === "studio",
    shareKit: plan === "studio",
    reports: plan === "studio",
    upsells: plan === "studio",
  };
}
