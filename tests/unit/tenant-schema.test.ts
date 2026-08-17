import { describe, expect, it } from "vitest";
import { WEEKDAY_KEYS } from "@/lib/tenant-schema";
import type { Tenant } from "@/lib/tenant-schema";

describe("tenant-schema", () => {
  it("exposes seven weekday keys", () => {
    expect(WEEKDAY_KEYS).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
  });

  it("Tenant shape accepts studio config fixtures", () => {
    const fixture: Pick<
      Tenant,
      "id" | "slug" | "studioName" | "packages" | "serviceAreaGate"
    > = {
      id: "fixture",
      slug: "fixture",
      studioName: "Fixture Studio",
      packages: [],
      serviceAreaGate: {
        enabled: true,
        region: "CA",
        prefixes: ["H"],
        message: "Test",
      },
    };
    expect(fixture.slug).toBe("fixture");
    expect(fixture.serviceAreaGate!.region).toBe("CA");
  });
});
