import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb, qRun, schema } from "@/lib/db";
import {
  backfillListingPages,
  getListingPage,
  getListingPageByOrder,
  getListingPageBySlug,
  getListingPageForAgent,
  listingCopyUrl,
  listingPageForPublic,
  listingPageLinks,
  listingPageMedia,
  listingPagePublicUrl,
  listListingPages,
  publishListingPage,
  slugifyAddress,
  updateListingPage,
} from "@/lib/listing-pages";
import { createBooking, getOrder } from "@/lib/orders";
import { getTenantRow } from "@/lib/tenant-store";
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

    await updateListingPage(byOrder!.id, tenant.id, {
      sections: [{ heading: "Kitchen", body: "Quartz counters." }],
      openHouses: [{ date: "2026-09-12", start: "2pm", end: "4pm", note: "" }],
      leadCapture: true,
      published: true,
      brandMode: "unbranded",
    });
    const listed = await listListingPages(tenant.id);
    expect(listed.some((page) => page.id === byOrder!.id)).toBe(true);
    const fetched = await getListingPage(byOrder!.id, tenant.id);
    expect(fetched?.leadCapture).toBeTruthy();
    expect(fetched?.brandMode).toBe("unbranded");
    expect(listingPagePublicUrl(fetched!, "https://example.test")).toMatch(/\/p\//);
    expect(listingCopyUrl(fetched!, "https://example.test")).toMatch(
      `/portal/listings/${fetched!.id}`,
    );
    expect(await getListingPage(byOrder!.id, "demo-studio")).toBeNull();
    expect(await listingPageForPublic(tenant.id, slug)).toBeTruthy();
  });

  it("publishes a listing page from a delivered-ready order", async () => {
    const tenant = await getTenant("eric-guan");
    const booked = await createBooking(tenant, bookingFixture(tenant));
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;
    const order = await getOrder(booked.orderId, tenant.id);
    const published = await publishListingPage(order!);
    expect(published.ok).toBe(true);
    if (!published.ok) return;
    expect(published.page.slug.length).toBeGreaterThan(2);
    const again = await publishListingPage(order!);
    expect(again.ok).toBe(true);
    expect(await listingPageMedia(published.page)).toEqual([]);
    expect(await listingPageLinks(published.page)).toEqual([]);
  });

  it("skips Starter, collides slugs, backfills delivered orders, and patches captions", async () => {
    const tenant = await getTenant("eric-guan");
    const db = getDb();
    const row = await getTenantRow(tenant.id);
    expect(row).toBeTruthy();

    const booked = await createBooking(tenant, bookingFixture(tenant));
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;
    const order = await getOrder(booked.orderId, tenant.id);

    try {
      await qRun(
        db.update(schema.tenants).set({ plan: "starter" }).where(eq(schema.tenants.id, tenant.id)),
      );
      const skipped = await publishListingPage(order!);
      expect(skipped.ok).toBe(false);
      if (!skipped.ok) expect(skipped.skipped).toBe(true);
    } finally {
      await qRun(
        db.update(schema.tenants).set({ plan: row!.plan }).where(eq(schema.tenants.id, tenant.id)),
      );
    }

    const missingStudio = await publishListingPage({ ...order!, tenantId: "no-such-studio" });
    expect(missingStudio.ok).toBe(false);

    const first = await publishListingPage(order!);
    expect(first.ok).toBe(true);

    const colliding = await createBooking(
      tenant,
      bookingFixture(tenant, { propertyAddress: order!.propertyAddress }),
    );
    expect(colliding.ok).toBe(true);
    if (colliding.ok) {
      const other = await getOrder(colliding.orderId, tenant.id);
      const second = await publishListingPage(other!);
      expect(second.ok).toBe(true);
      if (first.ok && second.ok) expect(second.page.slug).not.toBe(first.page.slug);
    }

    const delivered = await createBooking(tenant, bookingFixture(tenant));
    expect(delivered.ok).toBe(true);
    if (!delivered.ok) return;
    const deliveredOrder = await getOrder(delivered.orderId, tenant.id);
    await qRun(
      db
        .update(schema.orders)
        .set({ status: "delivered" })
        .where(eq(schema.orders.id, delivered.orderId)),
    );
    const now = new Date().toISOString();
    const galleryId = `gal_test_${Date.now()}`;
    await qRun(
      db.insert(schema.galleries).values({
        id: galleryId,
        tenantId: tenant.id,
        orderId: delivered.orderId,
        state: "proofing",
        publicToken: `tok_${Date.now()}`,
        brandMode: "branded",
        trustTier: "pay_first",
        title: deliveredOrder!.propertyAddress,
        propertyAddress: deliveredOrder!.propertyAddress,
        amountCents: deliveredOrder!.priceCents,
        currency: deliveredOrder!.currency,
        createdAt: now,
        updatedAt: now,
      }),
    );
    const assetId = `mas_${Date.now()}`;
    await qRun(
      db.insert(schema.mediaAssets).values({
        id: assetId,
        tenantId: tenant.id,
        galleryId,
        orderId: delivered.orderId,
        sortOrder: 0,
        originalName: "living.jpg",
        roomLabel: null,
        width: 1200,
        height: 800,
        bytesOriginal: 12,
        pathOriginal: "orig.jpg",
        pathWeb: "web.jpg",
        pathProof: "proof.jpg",
        pathMls: "mls.jpg",
        createdAt: now,
      }),
    );

    await backfillListingPages("no-such-studio");
    await backfillListingPages(tenant.id);
    const page = await getListingPageByOrder(delivered.orderId, tenant.id);
    expect(page).toBeTruthy();

    await qRun(
      db
        .update(schema.listingPages)
        .set({ galleryId })
        .where(eq(schema.listingPages.id, page!.id)),
    );
    const withGallery = await getListingPage(page!.id, tenant.id);
    expect((await listingPageMedia(withGallery!)).length).toBe(1);

    const patched = await updateListingPage(page!.id, tenant.id, {
      captions: [{ id: assetId, caption: "Living room" }],
      heroAssetId: assetId,
      title: "Captioned listing",
      published: false,
    });
    expect(patched.ok).toBe(true);
    expect(await listingPageForPublic(tenant.id, page!.slug)).toBeNull();
    expect((await updateListingPage("missing", tenant.id, { title: "x" })).ok).toBe(false);

    await backfillListingPages(tenant.id);
  });
});
