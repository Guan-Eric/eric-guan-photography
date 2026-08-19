import { describe, expect, it } from "vitest";
import { kindLabel, providerLabel } from "@/lib/embeds";
import { visibleLinks } from "@/lib/media-links";
import type { MediaLink } from "@/lib/db/schema";

function link(partial: Partial<MediaLink>): MediaLink {
  return {
    id: "mlk_1",
    tenantId: "ten",
    orderId: "ord",
    galleryId: null,
    listingPageId: null,
    kind: "video",
    provider: "youtube",
    url: "https://youtube.com/watch?v=abc",
    storagePath: null,
    title: "Walkthrough",
    sortOrder: 0,
    brandMode: "both",
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

describe("media-links visibility", () => {
  it("hides branded-only links on MLS galleries", () => {
    const rows = [
      link({ id: "both", brandMode: "both" }),
      link({ id: "branded", brandMode: "branded" }),
      link({ id: "mls", brandMode: "unbranded" }),
    ];
    expect(visibleLinks(rows, "unbranded").map((row) => row.id)).toEqual(["both", "mls"]);
    expect(visibleLinks(rows, "branded").map((row) => row.id)).toEqual(["both", "branded"]);
  });
});

describe("embed labels", () => {
  it("names providers and kinds", () => {
    expect(providerLabel("matterport")).toBe("Matterport");
    expect(providerLabel("link")).toBe("Link");
    expect(kindLabel("tour")).toBe("3D tour");
    expect(kindLabel("floorplan")).toBe("Floor plan");
    expect(kindLabel("doc")).toBe("Document");
    expect(kindLabel("other" as never)).toBe("Media");
  });
});
