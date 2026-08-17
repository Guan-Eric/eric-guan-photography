import { describe, expect, it, vi, afterEach } from "vitest";
import { parseAddressComponents, regionCodesForGate } from "@/lib/places";

describe("parseAddressComponents", () => {
  it("builds a Canadian street address", () => {
    const address = parseAddressComponents(
      [
        { longText: "123", types: ["street_number"] },
        { longText: "Main Street", types: ["route"] },
        { longText: "Montreal", types: ["locality"] },
        { longText: "Quebec", shortText: "QC", types: ["administrative_area_level_1"] },
        { longText: "H2X 1Y4", types: ["postal_code"] },
        { longText: "Canada", shortText: "CA", types: ["country"] },
      ],
      { placeId: "abc", formatted: "123 Main Street", lat: 45.5, lng: -73.6 },
    );
    expect(address.line1).toBe("123 Main Street");
    expect(address.city).toBe("Montreal");
    expect(address.region).toBe("QC");
    expect(address.postalCode).toBe("H2X 1Y4");
    expect(address.country).toBe("CA");
    expect(address.lat).toBe("45.5");
    expect(address.placeId).toBe("abc");
  });

  it("falls back to postal_town when locality is missing", () => {
    const address = parseAddressComponents([
      { longText: "10", types: ["street_number"] },
      { longText: "King Street", types: ["route"] },
      { longText: "Toronto", types: ["postal_town"] },
    ]);
    expect(address.city).toBe("Toronto");
  });
});

describe("regionCodesForGate", () => {
  it("omits a region when the studio has no gate", () => {
    expect(regionCodesForGate("none")).toEqual([]);
    expect(regionCodesForGate(undefined)).toEqual([]);
    expect(regionCodesForGate("CA")).toEqual(["CA"]);
    expect(regionCodesForGate("US")).toEqual(["US"]);
  });
});

describe("geo routes when Places is unconfigured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("suggest returns disabled without a key", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    const { POST } = await import("@/app/api/geo/suggest/route");
    const response = await POST(
      new Request("http://localhost/api/geo/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "123 Main", sessionToken: "session-token-1" }),
      }),
    );
    const json = await response.json();
    expect(json.disabled).toBe(true);
  });
});
