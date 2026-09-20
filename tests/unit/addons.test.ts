import { describe, expect, it } from "vitest";
import {
  addOnsForPackage,
  parseAddOnsJson,
  resolveSelectedAddOns,
} from "@/lib/addons";
import type { Package } from "@/lib/tenant-schema";

const standard: Package = {
  id: "standard",
  name: "Standard",
  summary: "Main",
  price: "$150",
  durationMinutes: 60,
  includes: [],
  priceCents: 15000,
};

const premium: Package = {
  id: "premium",
  name: "Premium",
  summary: "Main",
  price: "$250",
  durationMinutes: 75,
  includes: [],
  priceCents: 25000,
};

const floorPlan: Package = {
  id: "floor-plan",
  name: "Floor plan",
  summary: "2D plan",
  price: "$75",
  durationMinutes: null,
  includes: [],
  upsell: true,
  priceCents: 7500,
};

const twilight: Package = {
  id: "twilight",
  name: "Twilight",
  summary: "Dusk",
  price: "$125",
  durationMinutes: null,
  includes: [],
  upsell: true,
  priceCents: 12500,
  applicablePackageIds: ["premium"],
};

const packages = [standard, premium, floorPlan, twilight];

describe("addons", () => {
  it("treats empty applicablePackageIds as all packages", () => {
    const forStandard = addOnsForPackage(packages, "standard");
    expect(forStandard.map((pkg) => pkg.id)).toEqual(["floor-plan"]);

    const forPremium = addOnsForPackage(packages, "premium");
    expect(forPremium.map((pkg) => pkg.id).sort()).toEqual([
      "floor-plan",
      "twilight",
    ]);
  });

  it("resolves selected add-ons and rejects inapplicable ids", () => {
    const ok = resolveSelectedAddOns(packages, "standard", ["floor-plan"]);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.addOns).toEqual([
        { id: "floor-plan", name: "Floor plan", priceCents: 7500 },
      ]);
    }

    const bad = resolveSelectedAddOns(packages, "standard", ["twilight"]);
    expect(bad.ok).toBe(false);
  });

  it("parses add_ons_json snapshots", () => {
    expect(parseAddOnsJson(null)).toEqual([]);
    expect(
      parseAddOnsJson(
        JSON.stringify([{ id: "floor-plan", name: "Floor plan", priceCents: 7500 }]),
      ),
    ).toEqual([{ id: "floor-plan", name: "Floor plan", priceCents: 7500 }]);
    expect(parseAddOnsJson("{bad")).toEqual([]);
  });
});
