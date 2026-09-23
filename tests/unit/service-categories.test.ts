import { describe, expect, it } from "vitest";
import { parsePackages } from "@/lib/parse-packages";
import {
  groupPackagesByCategory,
  parseServiceCategories,
} from "@/lib/service-categories";
import type { Package } from "@/lib/tenant-schema";

function pkg(id: string, extra: Partial<Package> = {}): Package {
  return {
    id,
    name: id,
    summary: "",
    price: "$1",
    durationMinutes: 60,
    includes: [],
    ...extra,
  };
}

describe("parseServiceCategories", () => {
  it("drops unnamed rows, trims, and de-duplicates ids", () => {
    const parsed = parseServiceCategories([
      { id: "photo", name: "  Photography ", description: " HDR " },
      { id: "photo", name: "Photo 2" },
      { name: "" },
      { name: "Video & Drone" },
      "junk",
    ]);
    expect(parsed).toEqual([
      { id: "photo", name: "Photography", description: "HDR" },
      { id: "photo-2", name: "Photo 2" },
      { id: "cat_video-drone", name: "Video & Drone" },
    ]);
  });

  it("keeps existing categories when payload is not an array", () => {
    const keep = [{ id: "a", name: "A" }];
    expect(parseServiceCategories(undefined, keep)).toBe(keep);
  });
});

describe("groupPackagesByCategory", () => {
  it("orders groups by category, drops empty ones, and trails uncategorized", () => {
    const groups = groupPackagesByCategory(
      [
        pkg("a", { categoryId: "video" }),
        pkg("b"),
        pkg("c", { categoryId: "photo" }),
        pkg("d", { categoryId: "deleted" }),
      ],
      [
        { id: "photo", name: "Photography" },
        { id: "empty", name: "Empty" },
        { id: "video", name: "Video" },
      ],
    );
    expect(groups.map((g) => [g.category?.id ?? null, g.packages.map((p) => p.id)])).toEqual([
      ["photo", ["c"]],
      ["video", ["a"]],
      [null, ["b", "d"]],
    ]);
  });

  it("returns a single uncategorized group when no categories exist", () => {
    const groups = groupPackagesByCategory([pkg("a"), pkg("b")], undefined);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.category).toBeNull();
  });
});

describe("parsePackages categoryId", () => {
  it("keeps known category ids on shoot packages only", () => {
    const parsed = parsePackages(
      [
        pkg("shoot", { categoryId: "photo" }),
        pkg("stale", { categoryId: "gone" }),
        pkg("addon", { upsell: true, durationMinutes: null, categoryId: "photo" }),
      ],
      [],
      new Set(["photo"]),
    );
    expect(parsed.map((p) => p.categoryId)).toEqual(["photo", undefined, undefined]);
  });
});
