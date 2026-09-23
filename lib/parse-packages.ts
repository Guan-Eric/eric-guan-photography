import type { Package, PriceBand } from "@/lib/tenant-schema";

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback: number | null = null) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseBands(value: unknown): PriceBand[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const bands = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const priceCents = asNumber(row.priceCents, null);
      const maxSqft = asNumber(row.maxSqft, null);
      if (priceCents == null || maxSqft == null) return null;
      return {
        maxSqft,
        priceCents,
        label: asString(row.label) || `${maxSqft} sq ft`,
      };
    })
    .filter((item): item is PriceBand => item != null);
  return bands.length > 0 ? bands : undefined;
}

/**
 * Parse admin pricing editor payload into Package rows. `categoryIds` limits
 * which `categoryId` values survive; add-ons are never categorized.
 */
export function parsePackages(
  value: unknown,
  existing: Package[],
  categoryIds: ReadonlySet<string> = new Set(),
): Package[] {
  if (!Array.isArray(value)) return existing;
  const draft: Array<{
    id: string;
    name: string;
    summary: string;
    price: string;
    durationMinutes: number | null;
    includes: string[];
    featured?: boolean;
    upsell?: boolean;
    quoteLater?: boolean;
    priceCents?: number;
    priceBands?: PriceBand[];
    categoryId?: string;
    applicableRaw: string[];
  }> = [];

  value.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const row = item as Record<string, unknown>;
    const name = asString(row.name).trim();
    if (!name) return;
    const durationRaw = asNumber(row.durationMinutes, null);
    const includes = Array.isArray(row.includes)
      ? row.includes.map((line) => String(line).trim()).filter(Boolean)
      : [];
    const cents = asNumber(row.priceCents, null);
    const durationMinutes = durationRaw && durationRaw > 0 ? durationRaw : null;
    const upsell = Boolean(row.upsell);
    const quoteLater = Boolean(row.quoteLater) && durationMinutes != null && !upsell;
    const applicableRaw = Array.isArray(row.applicablePackageIds)
      ? row.applicablePackageIds.map((id) => String(id).trim()).filter(Boolean)
      : [];
    const categoryId = asString(row.categoryId).trim();
    draft.push({
      id: asString(row.id).trim() || `pkg_${index + 1}`,
      name,
      summary: asString(row.summary),
      price: asString(row.price) || (quoteLater ? "Quote after request" : ""),
      durationMinutes: upsell ? null : durationMinutes,
      includes,
      featured: Boolean(row.featured),
      upsell: upsell || undefined,
      quoteLater: quoteLater || undefined,
      priceCents: quoteLater ? undefined : cents ?? undefined,
      priceBands: quoteLater || upsell ? [] : parseBands(row.priceBands),
      categoryId: !upsell && categoryIds.has(categoryId) ? categoryId : undefined,
      applicableRaw,
    });
  });

  const knownIds = new Set(draft.map((pkg) => pkg.id));
  return draft.map(({ applicableRaw, ...pkg }) => {
    if (!pkg.upsell) {
      return { ...pkg, applicablePackageIds: undefined };
    }
    const applicablePackageIds = applicableRaw.filter((id) => knownIds.has(id));
    return {
      ...pkg,
      applicablePackageIds:
        applicablePackageIds.length > 0 ? applicablePackageIds : [],
    };
  });
}
