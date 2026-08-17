import { beforeAll, describe, expect, it } from "vitest";
import { getDb, qRun, schema } from "@/lib/db";
import {
  getListingPageByOrder,
  getListingPageBySlug,
  slugifyAddress,
} from "@/lib/listing-pages";
import { createBooking, getOrder } from "@/lib/orders";
import { getTenant } from "@/lib/tenants";
import { bookingFixture } from "../helpers/booking";
import { ensureTestDb } from "../helpers/db";

describe("listing pages", () => {
  beforeAll(() => {
    ensureTestDb();
  });

  it("creates and reads listing pages scoped to tenant", async () => {
    const tenant = await getTenant("eric-guan");
    const booked = await createBooking(tenant, bookingFixture(tenant));
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const order = await getOrder(booked.orderId, tenant.id);
    expect(order).toBeTruthy();

    const db = getDb();
    const now = new Date().toISOString();
    const slug = `${slugifyAddress(order!.propertyAddress)}-${Date.now()}`;
    await qRun(
      db.insert(schema.listingPages).values({
        id: `lp_${Date.now()}`,
        tenantId: tenant.id,
        orderId: order!.id,
        galleryId: null,
        slug,
        brandMode: "branded",
        title: order!.propertyAddress,
        propertyAddress: order!.propertyAddress,
        agentName: order!.agentName,
        agentEmail: order!.agentEmail,
        agentPhone: null,
        brokerage: null,
        mapLat: null,
        mapLng: null,
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      }),
    );

    const bySlug = await getListingPageBySlug(tenant.id, slug);
    expect(bySlug?.orderId).toBe(order!.id);

    const crossSlug = await getListingPageBySlug("demo-studio", slug);
    expect(crossSlug).toBeNull();

    const byOrder = await getListingPageByOrder(order!.id, tenant.id);
    expect(byOrder?.slug).toBe(slug);

    const crossOrder = await getListingPageByOrder(order!.id, "demo-studio");
    expect(crossOrder).toBeNull();
  });
});
