import { describe, expect, it } from "vitest";
import { parsePackages } from "@/lib/parse-packages";
import type { Package } from "@/lib/tenant-schema";

const existing: Package[] = [];

describe("parsePackages", () => {
  it("persists applicablePackageIds on add-ons and filters unknown ids", () => {
    const parsed = parsePackages(
      [
        {
          id: "standard",
          name: "Standard",
          summary: "Main",
          price: "$150",
          durationMinutes: 60,
          includes: [],
          priceCents: 15000,
        },
        {
          id: "floor-plan",
          name: "Floor plan",
          summary: "2D",
          price: "$75",
          durationMinutes: null,
          includes: [],
          upsell: true,
          priceCents: 7500,
          applicablePackageIds: ["standard", "missing"],
        },
        {
          id: "twilight",
          name: "Twilight",
          summary: "Dusk",
          price: "$125",
          durationMinutes: null,
          includes: [],
          upsell: true,
          priceCents: 12500,
          applicablePackageIds: [],
        },
      ],
      existing,
    );

    const floor = parsed.find((pkg) => pkg.id === "floor-plan")!;
    expect(floor.upsell).toBe(true);
    expect(floor.applicablePackageIds).toEqual(["standard"]);
    expect(floor.durationMinutes).toBeNull();
    expect(floor.priceBands).toEqual([]);

    const twilight = parsed.find((pkg) => pkg.id === "twilight")!;
    expect(twilight.applicablePackageIds).toEqual([]);

    const standard = parsed.find((pkg) => pkg.id === "standard")!;
    expect(standard.applicablePackageIds).toBeUndefined();
  });

  it("returns existing packages when payload is not an array", () => {
    const keep: Package[] = [
      {
        id: "standard",
        name: "Standard",
        summary: "",
        price: "$1",
        durationMinutes: 60,
        includes: [],
      },
    ];
    expect(parsePackages(null, keep)).toBe(keep);
  });
});
