import type { Package, Tenant } from "@/lib/tenant-schema";

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
    }
  | {
      ok: false;
      error: string;
      contactOnly?: boolean;
    };

type PriceBand = {
  maxSqft: number;
  priceCents: number;
  label: string;
};

/**
 * Firm price bands for bookable packages. Display ranges on the marketing site
 * stay human-readable; this table is what the booking engine quotes.
 */
const BANDS: Record<string, PriceBand[]> = {
  standard: [
    { maxSqft: 1500, priceCents: 15000, label: "under 1,500 sq ft" },
    { maxSqft: 2500, priceCents: 20000, label: "1,500–2,500 sq ft" },
    { maxSqft: Number.POSITIVE_INFINITY, priceCents: 25000, label: "over 2,500 sq ft" },
  ],
  premium: [
    { maxSqft: 1500, priceCents: 25000, label: "under 1,500 sq ft" },
    { maxSqft: 2500, priceCents: 30000, label: "1,500–2,500 sq ft" },
    { maxSqft: Number.POSITIVE_INFINITY, priceCents: 35000, label: "over 2,500 sq ft" },
  ],
};

function formatCad(cents: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
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

  if (pkg.durationMinutes == null || !BANDS[pkg.id]) {
    return {
      ok: false,
      error: "Retainers are custom — email to set up an ongoing booking window.",
      contactOnly: true,
    };
  }

  const squareFootage = Math.round(input.squareFootage);
  if (!Number.isFinite(squareFootage) || squareFootage < 400 || squareFootage > 20000) {
    return {
      ok: false,
      error: "Enter a square footage between 400 and 20,000.",
    };
  }

  const band =
    BANDS[pkg.id].find((candidate) => squareFootage <= candidate.maxSqft) ??
    BANDS[pkg.id][BANDS[pkg.id].length - 1];

  const durationMinutes = durationFor(pkg, squareFootage);
  if (durationMinutes == null) {
    return { ok: false, error: "This package cannot be booked online." };
  }

  return {
    ok: true,
    packageId: pkg.id,
    packageName: pkg.name,
    priceCents: band.priceCents,
    priceLabel: formatCad(band.priceCents),
    currency: tenant.seo.currency,
    durationMinutes,
    squareFootage,
    bandLabel: band.label,
  };
}

export function bookablePackages(tenant: Tenant) {
  return tenant.packages.filter((pkg) => pkg.durationMinutes != null && BANDS[pkg.id]);
}
