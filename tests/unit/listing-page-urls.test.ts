import { describe, expect, it } from "vitest";
import { listingCopyUrl, listingPagePublicUrl, slugifyAddress } from "@/lib/listing-pages";
import type { ListingPage } from "@/lib/db/schema";

const page = { id: "lp_abc", slug: "123-main-st" } as ListingPage;

describe("listing page URLs", () => {
  it("slugifies addresses", () => {
    expect(slugifyAddress("123 Main Street, Montréal")).toBe("123-main-street-montr-al");
    expect(slugifyAddress("!!!")).toBe("listing");
  });

  it("builds public and agent copy URLs", () => {
    expect(listingPagePublicUrl(page, "https://silentshutter.studiofront.ca")).toBe(
      "https://silentshutter.studiofront.ca/p/123-main-st",
    );
    expect(listingCopyUrl(page, "https://silentshutter.studiofront.ca")).toBe(
      "https://silentshutter.studiofront.ca/portal/listings/lp_abc",
    );
  });
});
