import type { Package } from "@/lib/tenant-schema";

export type SelectedAddOn = {
  id: string;
  name: string;
  priceCents: number;
};

/** Whether an upsell applies to the given shoot package. Empty list = all. */
export function addOnAppliesToPackage(addon: Package, packageId: string) {
  if (!addon.upsell) return false;
  const ids = addon.applicablePackageIds;
  if (!ids || ids.length === 0) return true;
  return ids.includes(packageId);
}

/** Bookable / gallery add-ons that apply to a shoot package and have a firm price. */
export function addOnsForPackage(packages: Package[], packageId: string): Package[] {
  return packages.filter(
    (pkg) =>
      pkg.upsell &&
      pkg.priceCents != null &&
      pkg.priceCents > 0 &&
      addOnAppliesToPackage(pkg, packageId),
  );
}

export function resolveSelectedAddOns(
  packages: Package[],
  packageId: string,
  addOnIds: string[] | undefined,
): { ok: true; addOns: SelectedAddOn[] } | { ok: false; error: string } {
  if (!addOnIds || addOnIds.length === 0) {
    return { ok: true, addOns: [] };
  }
  const unique = [...new Set(addOnIds.map((id) => id.trim()).filter(Boolean))];
  if (unique.length > 10) {
    return { ok: false, error: "Choose at most 10 add-ons." };
  }
  const available = addOnsForPackage(packages, packageId);
  const addOns: SelectedAddOn[] = [];
  for (const id of unique) {
    const match = available.find((pkg) => pkg.id === id);
    if (!match || match.priceCents == null) {
      return { ok: false, error: "One or more add-ons are not available for this package." };
    }
    addOns.push({
      id: match.id,
      name: match.name,
      priceCents: match.priceCents,
    });
  }
  return { ok: true, addOns };
}

export function parseAddOnsJson(raw: string | null | undefined): SelectedAddOn[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        const id = String(row.id ?? "").trim();
        const name = String(row.name ?? "").trim();
        const priceCents = Number(row.priceCents);
        if (!id || !name || !Number.isFinite(priceCents) || priceCents < 0) return null;
        return { id, name, priceCents: Math.round(priceCents) };
      })
      .filter((item): item is SelectedAddOn => item != null);
  } catch {
    return [];
  }
}
