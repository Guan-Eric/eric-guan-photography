import { beforeAll, describe, expect, it } from "vitest";
import { galleryReport, recordGalleryEvent } from "@/lib/gallery-analytics";
import { ensureGalleryForOrder } from "@/lib/galleries";
import { createBooking, getOrder } from "@/lib/orders";
import { getTenant } from "@/lib/tenants";
import { bookingFixture } from "../helpers/booking";
import { ensureTestDb } from "../helpers/db";

describe("gallery analytics", () => {
  beforeAll(() => {
    ensureTestDb();
  });

  it("counts views and downloads per gallery", async () => {
    const tenant = await getTenant("eric-guan");
    const booked = await createBooking(tenant, bookingFixture(tenant));
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const order = await getOrder(booked.orderId, tenant.id);
    const gallery = await ensureGalleryForOrder(order!, tenant);

    await recordGalleryEvent({
      tenantId: tenant.id,
      galleryId: gallery.id,
      orderId: order!.id,
      kind: "view",
    });
    await recordGalleryEvent({
      tenantId: tenant.id,
      galleryId: gallery.id,
      orderId: order!.id,
      kind: "view",
    });
    await recordGalleryEvent({
      tenantId: tenant.id,
      galleryId: gallery.id,
      orderId: order!.id,
      kind: "download",
    });

    const report = await galleryReport(gallery.id, tenant.id);
    expect(report.views).toBe(2);
    expect(report.downloads).toBe(1);
  });
});
