import { normalizeStudioCurrency } from "@/lib/currency";
import type { Package, PriceBand, Tenant } from "@/lib/tenant-schema";

export function tenantCurrency(tenant: Tenant) {
  return normalizeStudioCurrency(tenant.seo?.currency);
}

export type QuoteInput = {
  packageId: string;
  squareFootage: number;
};

export type QuoteResult =
  | {
      ok: true;
      packageId: string;
      packageName: string;
      priceCents: number;
      priceLabel: string;
      currency: string;
      durationMinutes: number;
      squareFootage: number;
      bandLabel: string;
      quoteLater?: boolean;
    }
  | {
      ok: false;
      error: string;
      contactOnly?: boolean;
    };

export const STANDARD_LISTING_BANDS: PriceBand[] = [
  { maxSqft: 1500, priceCents: 15000, label: "under 1,500 sq ft" },
  { maxSqft: 2500, priceCents: 20000, label: "1,500–2,500 sq ft" },
  { maxSqft: 99999, priceCents: 25000, label: "over 2,500 sq ft" },
];

export const PREMIUM_LISTING_BANDS: PriceBand[] = [
  { maxSqft: 1500, priceCents: 25000, label: "under 1,500 sq ft" },
  { maxSqft: 2500, priceCents: 30000, label: "1,500–2,500 sq ft" },
  { maxSqft: 99999, priceCents: 35000, label: "over 2,500 sq ft" },
];

export function priceBandsFor(pkg: Package): PriceBand[] | null {
  if (pkg.priceBands && pkg.priceBands.length > 0) return pkg.priceBands;
  if (pkg.priceCents != null && pkg.priceCents > 0) {
    return [
      {
        maxSqft: 99999,
        priceCents: pkg.priceCents,
        label: "any size",
      },
    ];
  }
  if (pkg.id === "standard") return STANDARD_LISTING_BANDS;
  if (pkg.id === "premium") return PREMIUM_LISTING_BANDS;
  return null;
}

export function isBookablePackage(pkg: Package) {
  if (pkg.durationMinutes == null) return false;
  if (pkg.quoteLater) return true;
  return priceBandsFor(pkg) != null;
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: normalizeStudioCurrency(currency),
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function durationFor(pkg: Package, squareFootage: number) {
  if (pkg.durationMinutes == null) return null;
  const largeHomeExtra = squareFootage > 2500 ? 15 : 0;
  const veryLargeExtra = squareFootage > 4000 ? 15 : 0;
  return pkg.durationMinutes + largeHomeExtra + veryLargeExtra;
}

export function quotePackage(tenant: Tenant, input: QuoteInput): QuoteResult {
  const pkg = tenant.packages.find((candidate) => candidate.id === input.packageId);
  if (!pkg) {
    return { ok: false, error: "Choose a package to continue." };
  }

  const squareFootage = Math.round(input.squareFootage);
  if (!Number.isFinite(squareFootage) || squareFootage < 400 || squareFootage > 20000) {
    return {
      ok: false,
      error: "Enter a square footage between 400 and 20,000.",
    };
  }

  if (pkg.quoteLater) {
    const durationMinutes = durationFor(pkg, squareFootage);
    if (durationMinutes == null) {
      return { ok: false, error: "This package cannot be booked online." };
    }
    const currency = tenantCurrency(tenant);
    return {
      ok: true,
      packageId: pkg.id,
      packageName: pkg.name,
      priceCents: 0,
      priceLabel: "Quote after request",
      currency,
      durationMinutes,
      squareFootage,
      bandLabel: "Price confirmed after review",
      quoteLater: true,
    };
  }

  const bands = priceBandsFor(pkg);
  if (pkg.durationMinutes == null || !bands) {
    return {
      ok: false,
      error: "Retainers are custom — email to set up an ongoing booking window.",
      contactOnly: true,
    };
  }

  const band =
    bands.find((candidate) => squareFootage <= candidate.maxSqft) ??
    bands[bands.length - 1]!;

  const durationMinutes = durationFor(pkg, squareFootage);
  if (durationMinutes == null) {
    return { ok: false, error: "This package cannot be booked online." };
  }

  const currency = tenantCurrency(tenant);
  return {
    ok: true,
    packageId: pkg.id,
    packageName: pkg.name,
    priceCents: band.priceCents,
    priceLabel: formatMoney(band.priceCents, currency),
    currency,
    durationMinutes,
    squareFootage,
    bandLabel: band.label,
  };
}

export function bookablePackages(tenant: Tenant) {
  return tenant.packages.filter(isBookablePackage);
}
