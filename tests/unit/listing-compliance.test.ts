import { describe, expect, it } from "vitest";
import {
  assertListingPublishReady,
  defaultAdvertisingEndsAt,
  listingContainsPrice,
  listingIsPubliclyLive,
  listingPublicState,
  suggestComplianceRegion,
} from "@/lib/listing-compliance";
import type { ListingPage } from "@/lib/db/schema";

describe("listing compliance", () => {
  it("suggests Québec from G/H/J postals and California from CA ZIPs", () => {
    expect(suggestComplianceRegion("H2X 1Y4")).toBe("ca_qc");
    expect(suggestComplianceRegion("G1R 4P5")).toBe("ca_qc");
    expect(suggestComplianceRegion("J4Z 0G2")).toBe("ca_qc");
    expect(suggestComplianceRegion("M5V 2T6")).toBe("ca_other");
    expect(suggestComplianceRegion("90210")).toBe("us_ca");
    expect(suggestComplianceRegion("10001")).toBe("ca_other");
  });

  it("detects price language for Québec guard", () => {
    expect(listingContainsPrice({ headline: "Asking $899,000" })).toBe(true);
    expect(listingContainsPrice({ description: "Sold for 5% over asking" })).toBe(
      true,
    );
    expect(listingContainsPrice({ headline: "Bright corner suite" })).toBe(false);
  });

  it("requires brokerage and phone before publish", () => {
    const result = assertListingPublishReady({
      page: {
        agentName: "Alex Agent",
        agentEmail: "a@example.com",
        brokerage: null,
        brokeragePhone: null,
        agentPhone: null,
        brandMode: "branded",
        complianceRegion: "ca_other",
        licenseDisplayName: null,
        licenseType: null,
        agencyLegalName: null,
        agencyLicenseType: null,
        advertisingEndsAt: defaultAdvertisingEndsAt(new Date().toISOString()),
        headline: null,
        description: null,
        title: "123 Main",
        sectionsJson: "[]",
      },
      media: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => /Brokerage/.test(e))).toBe(true);
      expect(result.errors.some((e) => /phone/i.test(e))).toBe(true);
    }
  });

  it("requires OACIQ fields and blocks price for Québec", () => {
    const result = assertListingPublishReady({
      page: {
        agentName: "Alex Agent",
        agentEmail: "a@example.com",
        brokerage: "Agence Exemple",
        brokeragePhone: "514-555-0100",
        agentPhone: null,
        brandMode: "branded",
        complianceRegion: "ca_qc",
        licenseDisplayName: null,
        licenseType: null,
        agencyLegalName: null,
        agencyLicenseType: null,
        advertisingEndsAt: defaultAdvertisingEndsAt(new Date().toISOString()),
        headline: "Listed at $1.2M",
        description: null,
        title: "123 Main",
        sectionsJson: "[]",
      },
      media: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => /Licence display name/.test(e))).toBe(true);
      expect(result.errors.some((e) => /sale or asking price/.test(e))).toBe(true);
    }
  });

  it("requires public original for California tagged assets", () => {
    const result = assertListingPublishReady({
      page: {
        agentName: "Alex Agent",
        agentEmail: "a@example.com",
        brokerage: "Example Realty",
        brokeragePhone: "310-555-0100",
        agentPhone: null,
        brandMode: "branded",
        complianceRegion: "us_ca",
        licenseDisplayName: null,
        licenseType: null,
        agencyLegalName: null,
        agencyLicenseType: null,
        advertisingEndsAt: defaultAdvertisingEndsAt(new Date().toISOString()),
        headline: null,
        description: null,
        title: "123 Main",
        sectionsJson: "[]",
      },
      media: [
        {
          id: "med_altered",
          enhancementTag: "virtually_staged",
          originalDisclosureAssetId: null,
          disclosurePublic: 0,
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => /unaltered original/.test(e))).toBe(true);
    }
  });

  it("treats deed signed or expired advertising window as offline", () => {
    const base = {
      publishedAt: "2026-01-01T00:00:00.000Z",
      deedSignedAt: null,
      advertisingEndsAt: "2099-01-01T00:00:00.000Z",
    } as ListingPage;
    expect(listingIsPubliclyLive(base)).toBe(true);
    expect(
      listingIsPubliclyLive({ ...base, deedSignedAt: "2026-06-01T00:00:00.000Z" }),
    ).toBe(false);
    expect(
      listingIsPubliclyLive({
        ...base,
        advertisingEndsAt: "2020-01-01T00:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("listingPublicState distinguishes live, waiting, draft, sold, ended, missing", () => {
    expect(listingPublicState(null).state).toBe("missing");

    const readyFields = {
      agentName: "Alex",
      agentEmail: "a@example.com",
      brokerage: "Brokerage Co",
      brokeragePhone: "514-555-0100",
      agentPhone: null,
      brandMode: "branded" as const,
      complianceRegion: "ca_other" as const,
      licenseDisplayName: null,
      licenseType: null,
      agencyLegalName: null,
      agencyLicenseType: null,
      advertisingEndsAt: "2099-01-01T00:00:00.000Z",
      headline: null,
      description: null,
      title: "123 Main",
      sectionsJson: "[]",
      publishedAt: null,
      deedSignedAt: null,
    } as ListingPage;

    expect(listingPublicState(readyFields).state).toBe("draft");
    expect(
      listingPublicState({
        ...readyFields,
        publishedAt: "2026-01-01T00:00:00.000Z",
      }).state,
    ).toBe("live");
    expect(
      listingPublicState({
        ...readyFields,
        publishedAt: "2026-01-01T00:00:00.000Z",
        deedSignedAt: "2026-06-01T00:00:00.000Z",
      }).state,
    ).toBe("sold");
    expect(
      listingPublicState({
        ...readyFields,
        publishedAt: "2026-01-01T00:00:00.000Z",
        advertisingEndsAt: "2020-01-01T00:00:00.000Z",
      }).state,
    ).toBe("ended");

    const waiting = listingPublicState({
      ...readyFields,
      brokerage: null,
      brokeragePhone: null,
    });
    expect(waiting.state).toBe("waiting_on_agent");
    expect(waiting.checklistErrors.length).toBeGreaterThan(0);
  });
});
