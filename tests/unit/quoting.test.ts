import { describe, expect, it } from "vitest";
import { ericGuan } from "@/content/tenants/eric-guan";
import { quotePackage, bookablePackages, priceBandsFor, isBookablePackage } from "@/lib/quoting";
import type { Package } from "@/lib/tenant-schema";

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

  it("rejects unknown packages and adds duration for large homes", () => {
    expect(
      quotePackage(ericGuan, { packageId: "nope", squareFootage: 1500 }).ok,
    ).toBe(false);
    const huge = quotePackage(ericGuan, {
      packageId: "standard",
      squareFootage: 4500,
    });
    expect(huge.ok).toBe(true);
    if (huge.ok) expect(huge.durationMinutes).toBe(90);
  });

  it("falls back to a flat priceCents band and rejects quote-later without duration", () => {
    const flat: Package = {
      id: "flat",
      name: "Flat",
      summary: "One price",
      price: "$99",
      durationMinutes: 45,
      includes: [],
      priceCents: 9900,
      priceBands: [],
    };
    expect(priceBandsFor(flat)?.[0]?.priceCents).toBe(9900);
    expect(isBookablePackage(flat)).toBe(true);

    const later = quotePackage(
      {
        ...ericGuan,
        packages: [
          {
            id: "ask",
            name: "Ask",
            summary: "Later",
            price: "Quote",
            durationMinutes: null,
            includes: [],
            quoteLater: true,
          },
        ],
      },
      { packageId: "ask", squareFootage: 1500 },
    );
    expect(later.ok).toBe(false);

    const noDuration = quotePackage(
      {
        ...ericGuan,
        packages: [
          {
            id: "bands",
            name: "Bands",
            summary: "Has bands",
            price: "$150",
            durationMinutes: null,
            includes: [],
            priceBands: [{ maxSqft: 99999, priceCents: 15000, label: "any" }],
          },
        ],
      },
      { packageId: "bands", squareFootage: 1500 },
    );
    expect(noDuration.ok).toBe(false);
    if (!noDuration.ok) expect(noDuration.contactOnly).toBe(true);
  });
});
