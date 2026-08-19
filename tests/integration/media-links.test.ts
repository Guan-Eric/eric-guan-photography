import { beforeAll, describe, expect, it } from "vitest";
import {
  addMediaDocument,
  addMediaLink,
  deleteMediaLink,
  getMediaLink,
  listMediaLinksForGallery,
  listMediaLinksForOrder,
  visibleLinks,
} from "@/lib/media-links";
import { createBooking, getOrder } from "@/lib/orders";
import { getTenant } from "@/lib/tenants";
import { bookingFixture } from "../helpers/booking";
import { ensureTestDb } from "../helpers/db";

describe("media links", () => {
  beforeAll(() => {
    ensureTestDb();
  });

  it("adds, scopes, and deletes shoot media links", async () => {
    const tenant = await getTenant("eric-guan");
    const booked = await createBooking(tenant, bookingFixture(tenant));
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;
    const order = await getOrder(booked.orderId, tenant.id);

    const video = await addMediaLink({
      tenantId: tenant.id,
      orderId: order!.id,
      galleryId: null,
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      title: "Walkthrough",
      brandMode: "branded",
    });
    expect(video.ok).toBe(true);
    if (!video.ok) return;

    const junk = await addMediaLink({
      tenantId: tenant.id,
      orderId: order!.id,
      galleryId: null,
      url: "   ",
    });
    expect(junk.ok).toBe(false);

    const pdf = await addMediaDocument({
      tenantId: tenant.id,
      orderId: order!.id,
      galleryId: null,
      storagePath: "tenants/eric-guan/plans/main.pdf",
      title: "Main floor",
    });
    expect(pdf.ok).toBe(true);

    const listed = await listMediaLinksForOrder(order!.id, tenant.id);
    expect(listed.length).toBe(2);
    expect(await listMediaLinksForGallery("missing-gallery")).toEqual([]);
    expect(visibleLinks(listed, "unbranded").every((row) => row.kind === "floorplan")).toBe(
      true,
    );

    expect(await getMediaLink(video.link.id, "demo-studio")).toBeNull();
    expect(await getMediaLink(video.link.id, tenant.id)).toBeTruthy();

    await deleteMediaLink(video.link.id, tenant.id);
    expect(await getMediaLink(video.link.id, tenant.id)).toBeNull();
  });
});
