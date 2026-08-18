import { describe, expect, it } from "vitest";
import { PLAN_DEFS } from "@/lib/plan-defs";
import {
  annualSoftwareCostUsd,
  cheapestPurchasablePlan,
  effectiveUsdPerIncludedListing,
  paygBillBreakEvenListings,
  paygRentBreakEvenListings,
  planAnnualUsd,
  planCompareRows,
  yearlyCostRows,
} from "@/lib/plan-compare";

describe("plan compare math", () => {
  it("prices Studio at $149 and Starter at 125 included listings", () => {
    expect(PLAN_DEFS.studio.monthlyUsd).toBe(149);
    expect(planAnnualUsd("studio")).toBe(1788);
    expect(PLAN_DEFS.starter.listingQuota).toBe(125);
  });

  it("puts Starter’s PAYG break-even inside the included quota", () => {
    const rent = paygRentBreakEvenListings("starter");
    expect(rent).toBe(118);
    expect(rent).toBeLessThanOrEqual(PLAN_DEFS.starter.listingQuota);
    expect(paygBillBreakEvenListings("starter")).toBe(118);
    expect(paygBillBreakEvenListings("growth")).toBe(238);
    expect(paygBillBreakEvenListings("studio")).toBe(358);
  });

  it("charges $5 on PAYG and $3 overage on flat plans", () => {
    expect(annualSoftwareCostUsd("payg", 120)).toBe(600);
    expect(annualSoftwareCostUsd("starter", 120)).toBe(588);
    expect(annualSoftwareCostUsd("starter", 130)).toBe(588 + 5 * 3);
    expect(annualSoftwareCostUsd("growth", 250)).toBe(1188);
    expect(annualSoftwareCostUsd("studio", 500)).toBe(1788);
  });

  it("picks PAYG at low volume and Starter once rent wins", () => {
    expect(cheapestPurchasablePlan(24)).toBe("payg");
    expect(cheapestPurchasablePlan(96)).toBe("payg");
    expect(cheapestPurchasablePlan(120)).toBe("starter");
    expect(effectiveUsdPerIncludedListing("starter")).toBeCloseTo(4.704, 3);
  });

  it("builds yearly sample rows with a lowest-bill plan", () => {
    const rows = yearlyCostRows();
    expect(rows[0]?.listings).toBe(24);
    expect(rows[0]?.cheapest).toBe("payg");
    const at120 = rows.find((row) => row.listings === 120);
    expect(at120?.cheapest).toBe("starter");
    expect(at120?.beatsPayg.starter).toBe(true);
    expect(at120?.beatsPayg.growth).toBe(false);
  });

  it("lists feature rows for every purchasable plan", () => {
    const labels = planCompareRows().map((row) => row.label);
    expect(labels).toContain("Custom domain");
    expect(labels).toContain("In-gallery upsells");
    const domain = planCompareRows().find((row) => row.label === "Custom domain");
    expect(domain?.values.starter).toBe(false);
    expect(domain?.values.payg).toBe(true);
    expect(domain?.values.growth).toBe(true);
  });
});
