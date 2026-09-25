import { describe, expect, it } from "vitest";
import {
  buildStudioConfig,
  DEFAULT_PRICING_LEDE,
  resolvePricingLede,
} from "@/lib/studio-defaults";
import { isBookablePackage } from "@/lib/quoting";

describe("studio-defaults", () => {
  it("builds a bookable starter studio", () => {
    const tenant = buildStudioConfig({
      id: "ten_new",
      slug: "newstudio",
      studioName: "New Studio",
      photographerName: "Pat",
      email: "pat@example.com",
      currency: "usd",
    });
    expect(tenant.slug).toBe("newstudio");
    expect(tenant.seo.currency).toBe("USD");
    expect(tenant.serviceAreaGate?.enabled).toBe(false);
    expect(tenant.packages.some((pkg) => pkg.id === "standard")).toBe(true);
    expect(isBookablePackage(tenant.packages.find((pkg) => pkg.id === "standard")!)).toBe(
      true,
    );
    expect(tenant.schedule.days.Sun.enabled).toBe(false);
    expect(tenant.pricingLede).toBe(DEFAULT_PRICING_LEDE);
  });

  it("uses the requested accent", () => {
    const tenant = buildStudioConfig({
      id: "ten_accent",
      slug: "accent",
      studioName: "Accent",
      photographerName: "Pat",
      email: "pat@example.com",
      accent: "#112233",
    });
    expect(tenant.theme.accent).toBe("#112233");
  });
});

describe("resolvePricingLede", () => {
  it("substitutes {turnaround} from the tenant", () => {
    expect(
      resolvePricingLede({
        turnaround: "same day",
        pricingLede: "Delivered in {turnaround}.",
      }),
    ).toBe("Delivered in same day.");
  });

  it("falls back to the default when pricingLede is missing or blank", () => {
    expect(resolvePricingLede({ turnaround: "24–48 hours" })).toBe(
      DEFAULT_PRICING_LEDE.replaceAll("{turnaround}", "24–48 hours"),
    );
    expect(
      resolvePricingLede({ turnaround: "24–48 hours", pricingLede: "   " }),
    ).toBe(DEFAULT_PRICING_LEDE.replaceAll("{turnaround}", "24–48 hours"));
  });

  it("leaves custom copy without the token unchanged", () => {
    expect(
      resolvePricingLede({
        turnaround: "24–48 hours",
        pricingLede: "Custom packages only — email for a quote.",
      }),
    ).toBe("Custom packages only — email for a quote.");
  });
});
