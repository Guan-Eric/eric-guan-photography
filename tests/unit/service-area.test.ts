import { describe, expect, it } from "vitest";
import {
  formatPostalCode,
  isInServiceArea,
  isValidCanadianPostalCode,
  isValidPostalForTenant,
  isValidUsZip,
  normalizePostalCode,
  serviceAreaMessage,
} from "@/lib/service-area";
import type { Tenant } from "@/lib/tenant-schema";

const montrealTenant = {
  serviceAreaGate: {
    enabled: true,
    region: "CA" as const,
    prefixes: ["H", "J3"],
    message: "Montréal only",
  },
} as unknown as Tenant;

describe("service-area", () => {
  it("normalizes and formats CA / US postals", () => {
    expect(normalizePostalCode("h2x 1y4")).toBe("H2X1Y4");
    expect(formatPostalCode("H2X1Y4")).toBe("H2X 1Y4");
    expect(formatPostalCode("10001")).toBe("10001");
    expect(formatPostalCode("100011234")).toBe("10001-1234");
    expect(formatPostalCode("H2X")).toBe("H2X");
  });

  it("validates CA and US shapes", () => {
    expect(isValidCanadianPostalCode("H2X 1Y4")).toBe(true);
    expect(isValidCanadianPostalCode("H2X1Y")).toBe(false);
    expect(isValidUsZip("10001")).toBe(true);
    expect(isValidUsZip("10001-1234")).toBe(true);
    expect(isValidUsZip("1000")).toBe(false);
  });

  it("gates Montréal prefixes when enabled", () => {
    expect(isValidPostalForTenant("H2X 1Y4", montrealTenant)).toBe(true);
    expect(isInServiceArea("H2X 1Y4", montrealTenant)).toBe(true);
    expect(isInServiceArea("M5V 2T6", montrealTenant)).toBe(false);
    expect(isInServiceArea("10001", montrealTenant)).toBe(false);
    expect(serviceAreaMessage(montrealTenant)).toBe("Montréal only");
  });

  it("relaxes when gate disabled or region none", () => {
    const open = {
      serviceAreaGate: {
        enabled: false,
        region: "none" as const,
        prefixes: [] as string[],
        message: "Anywhere",
      },
    } as unknown as Tenant;
    expect(isValidPostalForTenant("XYZ", open)).toBe(true);
    expect(isInServiceArea("XYZ", open)).toBe(true);
  });

  it("validates US ZIPs when the gate is US", () => {
    const us = {
      serviceAreaGate: {
        enabled: true,
        region: "US" as const,
        prefixes: ["100"],
        message: "NYC only",
      },
    } as unknown as Tenant;
    expect(isValidPostalForTenant("10001", us)).toBe(true);
    expect(isInServiceArea("10001", us)).toBe(true);
    expect(isInServiceArea("90210", us)).toBe(false);
    expect(isInServiceArea("H2X 1Y4", us)).toBe(false);
  });

  it("allows any valid postal when prefixes are empty", () => {
    const wide = {
      serviceAreaGate: {
        enabled: true,
        region: "CA" as const,
        prefixes: [] as string[],
        message: "Canada",
      },
    } as unknown as Tenant;
    expect(isInServiceArea("M5V 2T6", wide)).toBe(true);
  });

  it("uses the default Greater Montréal gate when none is set", () => {
    expect(isInServiceArea("H2X 1Y4")).toBe(true);
    expect(isInServiceArea("M5V 2T6")).toBe(false);
    expect(serviceAreaMessage()).toMatch(/Montréal|Montreal/);
  });
});
