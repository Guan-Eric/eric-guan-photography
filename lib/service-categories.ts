import type { Package, ServiceCategory } from "@/lib/tenant-schema";

export const MAX_SERVICE_CATEGORIES = 20;

export type ServiceCategoryGroup = {
  /** Null for the trailing "uncategorized" bucket. */
  category: ServiceCategory | null;
  packages: Package[];
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Parse admin pricing editor payload into ordered categories with unique ids. */
export function parseServiceCategories(
  value: unknown,
  existing: ServiceCategory[] = [],
): ServiceCategory[] {
  if (!Array.isArray(value)) return existing;
  const seen = new Set<string>();
  const out: ServiceCategory[] = [];
  for (const item of value) {
    if (out.length >= MAX_SERVICE_CATEGORIES) break;
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim().slice(0, 60) : "";
    if (!name) continue;
    const rawId = typeof row.id === "string" ? row.id.trim() : "";
    let id = rawId || `cat_${slugify(name) || out.length + 1}`;
    if (seen.has(id)) {
      let n = 2;
      while (seen.has(`${id}-${n}`)) n += 1;
      id = `${id}-${n}`;
    }
    seen.add(id);
    const description =
      typeof row.description === "string" ? row.description.trim().slice(0, 200) : "";
    out.push(description ? { id, name, description } : { id, name });
  }
  return out;
}

/**
 * Group packages in category order. Packages whose category is missing land in
 * a trailing null-category group; empty categories are dropped.
 */
export function groupPackagesByCategory(
  packages: Package[],
  categories: ServiceCategory[] | undefined,
): ServiceCategoryGroup[] {
  const list = categories ?? [];
  const byId = new Map(list.map((category) => [category.id, [] as Package[]]));
  const uncategorized: Package[] = [];
  for (const pkg of packages) {
    const bucket = pkg.categoryId ? byId.get(pkg.categoryId) : undefined;
    if (bucket) bucket.push(pkg);
    else uncategorized.push(pkg);
  }
  const groups: ServiceCategoryGroup[] = list
    .map((category) => ({ category, packages: byId.get(category.id)! }))
    .filter((group) => group.packages.length > 0);
  if (uncategorized.length > 0) groups.push({ category: null, packages: uncategorized });
  return groups;
}
