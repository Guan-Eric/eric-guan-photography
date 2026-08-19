import { describe, expect, it } from "vitest";
import { buildStudioConfig } from "@/lib/studio-defaults";
import { isBookablePackage } from "@/lib/quoting";

describe("studio-defaults", () => {
  it("builds a bookable starter studio", () => {
    const tenant = buildStudioConfig({
      id: "ten_new",
      slug: "newstudio",
      studioName: "New Studio",
      photographerName: "Pat",
      email: "pat@example.com",
      currency: "usd",
    });
    expect(tenant.slug).toBe("newstudio");
    expect(tenant.seo.currency).toBe("USD");
    expect(tenant.serviceAreaGate?.enabled).toBe(false);
    expect(tenant.packages.some((pkg) => pkg.id === "standard")).toBe(true);
    expect(isBookablePackage(tenant.packages.find((pkg) => pkg.id === "standard")!)).toBe(
      true,
    );
    expect(tenant.schedule.days.Sun.enabled).toBe(false);
  });

  it("uses the requested accent", () => {
    const tenant = buildStudioConfig({
      id: "ten_accent",
      slug: "accent",
      studioName: "Accent",
      photographerName: "Pat",
      email: "pat@example.com",
      accent: "#112233",
    });
    expect(tenant.theme.accent).toBe("#112233");
  });
});
