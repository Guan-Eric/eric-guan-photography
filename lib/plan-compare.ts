import { PLAN_DEFS, entitlements } from "@/lib/plan-defs";
import {
  PURCHASABLE_PLANS,
  type PurchasablePlanId,
} from "@/lib/db/schema";

export const FLAT_PLANS = ["starter", "growth", "studio"] as const;
export type FlatPlanId = (typeof FLAT_PLANS)[number];

/** Listing volumes shown in the yearly cost table (2, 4, 8, 10, ~21, ~42 / month). */
export const COMPARE_LISTING_SAMPLES = [24, 48, 96, 120, 250, 500] as const;

export function formatUsd(amount: number) {
  const rounded = Math.round(amount * 100) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
  }).format(rounded);
}

export function planAnnualUsd(plan: PurchasablePlanId) {
  return PLAN_DEFS[plan].monthlyUsd * 12;
}

export function planStorageLabel(plan: PurchasablePlanId) {
  const gb = Math.round(PLAN_DEFS[plan].storageBytes / 1024 ** 3);
  return `${gb} GB`;
}

/**
 * Yearly software bill at a listing volume, including $3 overage on flat plans
 * and $5/listing on pay as you go.
 */
export function annualSoftwareCostUsd(plan: PurchasablePlanId, listings: number) {
  const def = PLAN_DEFS[plan];
  if (plan === "payg") return listings * def.meteredUsd;
  return planAnnualUsd(plan) + Math.max(0, listings - def.listingQuota) * def.meteredUsd;
}

export function cheapestPurchasablePlan(listings: number): PurchasablePlanId {
  let best: PurchasablePlanId = "payg";
  let bestCost = annualSoftwareCostUsd("payg", listings);
  for (const plan of PURCHASABLE_PLANS) {
    const cost = annualSoftwareCostUsd(plan, listings);
    if (cost < bestCost - 0.001) {
      best = plan;
      bestCost = cost;
    }
  }
  return best;
}

/**
 * First whole listing count where 12 months of rent costs less than the same
 * volume on pay as you go. Ignores included-quota caps.
 */
export function paygRentBreakEvenListings(plan: FlatPlanId) {
  return Math.ceil(planAnnualUsd(plan) / PLAN_DEFS.payg.meteredUsd);
}

/**
 * First whole listing count where this flat plan's invoice (rent + $3 overage)
 * undercuts pay as you go. Use this on the pricing page — a plan whose included
 * quota sits below the rent break-even still wins once overage is cheaper than $5.
 */
export function paygBillBreakEvenListings(plan: FlatPlanId) {
  const payg = PLAN_DEFS.payg.meteredUsd;
  const def = PLAN_DEFS[plan];
  const annual = planAnnualUsd(plan);
  const withinQuota = Math.ceil(annual / payg);
  if (withinQuota <= def.listingQuota) return withinQuota;
  const n = (annual - def.meteredUsd * def.listingQuota) / (payg - def.meteredUsd);
  return Math.ceil(n);
}

export function effectiveUsdPerIncludedListing(plan: FlatPlanId) {
  return planAnnualUsd(plan) / PLAN_DEFS[plan].listingQuota;
}

export type CompareValue = string | boolean;

export type CompareRow = {
  label: string;
  values: Record<PurchasablePlanId, CompareValue>;
};

export function planCompareRows(): CompareRow[] {
  const rows: CompareRow[] = [
    {
      label: "Price",
      values: {
        payg: `${formatUsd(PLAN_DEFS.payg.meteredUsd)} / listing`,
        starter: `${formatUsd(PLAN_DEFS.starter.monthlyUsd)} / mo`,
        growth: `${formatUsd(PLAN_DEFS.growth.monthlyUsd)} / mo`,
        studio: `${formatUsd(PLAN_DEFS.studio.monthlyUsd)} / mo`,
      },
    },
    {
      label: "Listings included",
      values: {
        payg: "Pay per shoot",
        starter: `${PLAN_DEFS.starter.listingQuota} / year`,
        growth: `${PLAN_DEFS.growth.listingQuota} / year`,
        studio: `${PLAN_DEFS.studio.listingQuota} / year`,
      },
    },
    {
      label: "Extra listings",
      values: {
        payg: `${formatUsd(PLAN_DEFS.payg.meteredUsd)} each`,
        starter: `${formatUsd(PLAN_DEFS.starter.meteredUsd)} each`,
        growth: `${formatUsd(PLAN_DEFS.growth.meteredUsd)} each`,
        studio: `${formatUsd(PLAN_DEFS.studio.meteredUsd)} each`,
      },
    },
    {
      label: "Team seats",
      values: {
        payg: String(PLAN_DEFS.payg.seats),
        starter: String(PLAN_DEFS.starter.seats),
        growth: String(PLAN_DEFS.growth.seats),
        studio: String(PLAN_DEFS.studio.seats),
      },
    },
    {
      label: "Storage",
      values: {
        payg: planStorageLabel("payg"),
        starter: planStorageLabel("starter"),
        growth: planStorageLabel("growth"),
        studio: planStorageLabel("studio"),
      },
    },
    {
      label: "White-label site + booking",
      values: { payg: true, starter: true, growth: true, studio: true },
    },
    {
      label: "Gated galleries + MLS zips",
      values: { payg: true, starter: true, growth: true, studio: true },
    },
  ];

  const feature = (
    label: string,
    key: keyof ReturnType<typeof entitlements>,
  ): CompareRow => ({
    label,
    values: {
      payg: entitlements("payg")[key],
      starter: entitlements("starter")[key],
      growth: entitlements("growth")[key],
      studio: entitlements("studio")[key],
    },
  });

  rows.push(
    feature("Custom domain", "customDomain"),
    feature("Property websites", "propertyPages"),
    feature("Share kit", "shareKit"),
    feature("Gallery reports", "reports"),
    feature("In-gallery upsells", "upsells"),
  );

  return rows;
}

export function paygMathCards() {
  return FLAT_PLANS.map((plan) => {
    const def = PLAN_DEFS[plan];
    const annual = planAnnualUsd(plan);
    const rentBreakEven = paygRentBreakEvenListings(plan);
    const billBreakEven = paygBillBreakEvenListings(plan);
    return {
      plan,
      label: def.label,
      monthlyUsd: def.monthlyUsd,
      annualUsd: annual,
      listingQuota: def.listingQuota,
      rentBreakEven,
      billBreakEven,
      effectiveUsd: effectiveUsdPerIncludedListing(plan),
      fitsInsideQuota: rentBreakEven <= def.listingQuota,
    };
  });
}

export function yearlyCostRows() {
  return COMPARE_LISTING_SAMPLES.map((listings) => {
    const costs = Object.fromEntries(
      PURCHASABLE_PLANS.map((plan) => [plan, annualSoftwareCostUsd(plan, listings)]),
    ) as Record<PurchasablePlanId, number>;
    const cheapest = cheapestPurchasablePlan(listings);
    return {
      listings,
      perMonth: listings / 12,
      costs,
      cheapest,
      beatsPayg: {
        payg: false,
        starter: costs.starter < costs.payg,
        growth: costs.growth < costs.payg,
        studio: costs.studio < costs.payg,
      } satisfies Record<PurchasablePlanId, boolean>,
    };
  });
}
