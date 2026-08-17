import { describe, expect, it } from "vitest";
import {
  DEFAULT_STUDIO_TIMEZONE,
  isValidTimeZone,
  listTimeZones,
  normalizeTimeZone,
} from "@/lib/timezones";

describe("studio timezones", () => {
  it("lists the full IANA set", () => {
    const zones = listTimeZones();
    expect(zones.length).toBeGreaterThan(100);
    expect(zones).toContain("America/Toronto");
    expect(zones).toContain("Asia/Tokyo");
    expect(zones).toContain("Europe/London");
    expect(zones).toContain("Australia/Sydney");
    expect(zones).toContain("Africa/Johannesburg");
  });

  it("validates and normalizes", () => {
    expect(isValidTimeZone("Asia/Tokyo")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(normalizeTimeZone("Europe/Paris")).toBe("Europe/Paris");
    expect(normalizeTimeZone("bogus")).toBe(DEFAULT_STUDIO_TIMEZONE);
    expect(normalizeTimeZone(undefined)).toBe(DEFAULT_STUDIO_TIMEZONE);
  });
});
