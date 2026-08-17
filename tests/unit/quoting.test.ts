import { describe, expect, it } from "vitest";
import { ericGuan } from "@/content/tenants/eric-guan";
import { quotePackage, bookablePackages } from "@/lib/quoting";

describe("quoting", () => {
  it("lists bookable packages", () => {
    const bookable = bookablePackages(ericGuan);
    expect(bookable.some((pkg) => pkg.id === "standard")).toBe(true);
    expect(bookable.some((pkg) => pkg.id === "retainer")).toBe(false);
  });

  it("prices standard bands by sqft and adds duration", () => {
    const small = quotePackage(ericGuan, {
      packageId: "standard",
      squareFootage: 1200,
    });
    expect(small.ok).toBe(true);
    if (small.ok) {
      expect(small.priceCents).toBe(15000);
      expect(small.durationMinutes).toBe(60);
    }

    const large = quotePackage(ericGuan, {
      packageId: "standard",
      squareFootage: 3000,
    });
    expect(large.ok).toBe(true);
    if (large.ok) {
      expect(large.priceCents).toBe(25000);
      expect(large.durationMinutes).toBe(75);
    }
  });

  it("rejects invalid sqft and contact-only retainers", () => {
    expect(
      quotePackage(ericGuan, { packageId: "standard", squareFootage: 100 }).ok,
    ).toBe(false);
    const retainer = quotePackage(ericGuan, {
      packageId: "retainer",
      squareFootage: 1500,
    });
    expect(retainer.ok).toBe(false);
    if (!retainer.ok) expect(retainer.contactOnly).toBe(true);
  });

  it("allows quote-later packages without a firm price", () => {
    const tenant = {
      ...ericGuan,
      packages: ericGuan.packages.map((pkg) =>
        pkg.id === "standard"
          ? {
              ...pkg,
              quoteLater: true,
              priceCents: undefined,
              priceBands: [],
              price: "Quote after request",
            }
          : pkg,
      ),
    };
    const quoted = quotePackage(tenant, {
      packageId: "standard",
      squareFootage: 1800,
    });
    expect(quoted.ok).toBe(true);
    if (quoted.ok) {
      expect(quoted.quoteLater).toBe(true);
      expect(quoted.priceCents).toBe(0);
      expect(quoted.priceLabel).toBe("Quote after request");
    }
  });
});
