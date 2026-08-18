import { beforeAll, describe, expect, it } from "vitest";
import { getDb, qRun, schema } from "@/lib/db";
import {
  getListingPageByOrder,
  getListingPageBySlug,
  getListingPageForAgent,
  slugifyAddress,
  updateListingPage,
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

    const forAgent = await getListingPageForAgent(
      byOrder!.id,
      tenant.id,
      order!.agentEmail,
    );
    expect(forAgent?.id).toBe(byOrder!.id);
    expect(
      await getListingPageForAgent(byOrder!.id, tenant.id, "other@example.com"),
    ).toBeNull();

    await updateListingPage(byOrder!.id, tenant.id, {
      headline: "Sun-filled semi",
      description: "Two beds near the park.",
    });
    await updateListingPage(byOrder!.id, tenant.id, { theme: "editorial" });
    const afterPhotoSave = await getListingPageByOrder(order!.id, tenant.id);
    expect(afterPhotoSave?.headline).toBe("Sun-filled semi");
    expect(afterPhotoSave?.description).toBe("Two beds near the park.");
    expect(afterPhotoSave?.title).toBe("Sun-filled semi");
  });
});
