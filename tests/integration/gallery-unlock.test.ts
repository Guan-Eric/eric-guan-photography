import { beforeAll, describe, expect, it } from "vitest";
import {
  acceptGalleryLicense,
  ensureGalleryForOrder,
  getGalleryById,
  getGalleryByToken,
  publishDelivery,
  refreshGalleryLink,
  unlockGallery,
} from "@/lib/galleries";
import { createBooking } from "@/lib/orders";
import { getTenant } from "@/lib/tenants";
import { bookingFixture } from "../helpers/booking";
import { ensureTestDb } from "../helpers/db";
import { jsonRequest, readJson } from "../helpers/http";

describe("gallery stub unlock", () => {
  beforeAll(() => {
    ensureTestDb();
    delete process.env.STRIPE_SECRET_KEY;
  });

  it("unlocks via checkout stub and rotates the public token", async () => {
    const tenant = await getTenant("eric-guan");
    const booked = await createBooking(tenant, bookingFixture(tenant));
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const { getOrder } = await import("@/lib/orders");
    const order = await getOrder(booked.orderId, tenant.id);
    expect(order).toBeTruthy();
    const gallery = await ensureGalleryForOrder(order!, tenant);
    expect(gallery.state).not.toBe("unlocked");
    const oldToken = gallery.publicToken;

    const { POST } = await import("@/app/api/g/[token]/checkout/route");
    const response = await POST(
      jsonRequest(`http://localhost:3000/api/g/${oldToken}/checkout`, {
        stub: true,
      }),
      { params: Promise.resolve({ token: oldToken }) },
    );
    const json = await readJson<{
      ok: boolean;
      stubbed?: boolean;
      unlocked?: boolean;
      publicToken?: string;
      galleryUrl?: string;
    }>(response);

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.stubbed).toBe(true);
    expect(json.unlocked).toBe(true);
    expect(json.publicToken).toBeTruthy();
    expect(json.publicToken).not.toBe(oldToken);
    expect(json.galleryUrl).toContain(`/g/${json.publicToken}`);

    expect(await getGalleryByToken(oldToken)).toBeNull();
    const refreshed = await getGalleryByToken(json.publicToken!);
    expect(refreshed?.state).toBe("unlocked");
    expect(refreshed?.expiresAt).toBeTruthy();
    expect(refreshed?.licenseAcceptedAt).toBeNull();
  });

  it("does not treat a returning agent's new gallery as already paid", async () => {
    const tenant = await getTenant("eric-guan");
    const email = `repeat-${Date.now()}@example.com`;
    const first = await createBooking(
      tenant,
      bookingFixture(tenant, { agentEmail: email }),
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const { getOrder } = await import("@/lib/orders");
    const firstOrder = await getOrder(first.orderId, tenant.id);
    const firstGallery = await ensureGalleryForOrder(firstOrder!, tenant);

    const { POST } = await import("@/app/api/g/[token]/checkout/route");
    await POST(
      jsonRequest(`http://localhost:3000/api/g/${firstGallery.publicToken}/checkout`, {
        stub: true,
      }),
      { params: Promise.resolve({ token: firstGallery.publicToken }) },
    );

    const second = await createBooking(
      tenant,
      bookingFixture(tenant, { agentEmail: email }),
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    const secondOrder = await getOrder(second.orderId, tenant.id);
    const secondGallery = await ensureGalleryForOrder(secondOrder!, tenant);
    expect(secondGallery.state).toBe("proofing");
    expect(secondOrder?.status).not.toBe("paid");

    const response = await POST(
      jsonRequest(`http://localhost:3000/api/g/${secondGallery.publicToken}/checkout`, {
        stub: false,
      }),
      { params: Promise.resolve({ token: secondGallery.publicToken }) },
    );
    const json = await readJson<{
      ok: boolean;
      alreadyUnlocked?: boolean;
      stubbed?: boolean;
    }>(response);

    expect(json.alreadyUnlocked).not.toBe(true);
    expect(secondGallery.publicToken).not.toBe(firstGallery.publicToken);
  });
});

describe("gallery token security", () => {
  beforeAll(() => {
    ensureTestDb();
    delete process.env.STRIPE_SECRET_KEY;
  });

  it("rejects unpaid web/mls/full variants with 402", async () => {
    const tenant = await getTenant("eric-guan");
    const booked = await createBooking(tenant, bookingFixture(tenant));
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const { getOrder } = await import("@/lib/orders");
    const order = await getOrder(booked.orderId, tenant.id);
    const gallery = await ensureGalleryForOrder(order!, tenant);

    const { GET } = await import("@/app/api/g/[token]/media/[assetId]/route");
    // No media yet — still exercises unlock gate before asset lookup... actually asset lookup is first after gallery.
    // Create a fake media row path by adding an upload isn't trivial; gate runs after media find.
    // Use unlock path: without media, media route returns 404 for missing asset, but unlock check is after find.
    // So add a minimal media asset via DB.
    const { getDb, qRun, schema } = await import("@/lib/db");
    const db = getDb();
    const assetId = `med_test_${Date.now()}`;
    await qRun(
      db.insert(schema.mediaAssets).values({
        id: assetId,
        tenantId: tenant.id,
        galleryId: gallery.id,
        orderId: order!.id,
        sortOrder: 0,
        originalName: "test.jpg",
        roomLabel: null,
        width: 100,
        height: 100,
        bytesOriginal: 10,
        pathOriginal: "x/original.jpg",
        pathWeb: "x/web.jpg",
        pathProof: "x/proof.jpg",
        pathMls: "x/mls.jpg",
        createdAt: new Date().toISOString(),
      }),
    );

    for (const variant of ["web", "mls", "full"] as const) {
      const response = await GET(
        new Request(`http://localhost:3000/api/g/${gallery.publicToken}/media/${assetId}?v=${variant}`),
        { params: Promise.resolve({ token: gallery.publicToken, assetId }) },
      );
      expect(response.status).toBe(402);
    }

    const proof = await GET(
      new Request(`http://localhost:3000/api/g/${gallery.publicToken}/media/${assetId}?v=proof`),
      { params: Promise.resolve({ token: gallery.publicToken, assetId }) },
    );
    // Proof may 500 if file missing — but must not be 402
    expect(proof.status).not.toBe(402);
  });

  it("blocks zip until license accepted after unlock", async () => {
    const tenant = await getTenant("eric-guan");
    const booked = await createBooking(tenant, bookingFixture(tenant));
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const { getOrder } = await import("@/lib/orders");
    const order = await getOrder(booked.orderId, tenant.id);
    const gallery = await ensureGalleryForOrder(order!, tenant);
    const unlocked = await unlockGallery(gallery.id, { markOrderPaid: true });
    expect(unlocked.ok).toBe(true);
    if (!unlocked.ok) return;

    const token = unlocked.gallery.publicToken;
    const { GET } = await import("@/app/api/g/[token]/download/route");
    const blocked = await GET(
      new Request(`http://localhost:3000/api/g/${token}/download?kind=mls`),
      { params: Promise.resolve({ token }) },
    );
    expect(blocked.status).toBe(403);

    const accepted = await acceptGalleryLicense(unlocked.gallery.id);
    expect(accepted.ok).toBe(true);

    const after = await GET(
      new Request(`http://localhost:3000/api/g/${token}/download?kind=mls`),
      { params: Promise.resolve({ token }) },
    );
    // No media → 404 once license clears; must not be 403
    expect(after.status).not.toBe(403);
    expect([200, 404]).toContain(after.status);
  });

  it("sets expiry on publish and refresh rotates token", async () => {
    const tenant = await getTenant("eric-guan");
    const booked = await createBooking(tenant, bookingFixture(tenant));
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const { getOrder } = await import("@/lib/orders");
    const order = await getOrder(booked.orderId, tenant.id);
    const gallery = await ensureGalleryForOrder(order!, tenant);

    const { getDb, qRun, schema } = await import("@/lib/db");
    const db = getDb();
    await qRun(
      db.insert(schema.mediaAssets).values({
        id: `med_pub_${Date.now()}`,
        tenantId: tenant.id,
        galleryId: gallery.id,
        orderId: order!.id,
        sortOrder: 0,
        originalName: "test.jpg",
        roomLabel: null,
        width: 100,
        height: 100,
        bytesOriginal: 10,
        pathOriginal: "x/original.jpg",
        pathWeb: "x/web.jpg",
        pathProof: "x/proof.jpg",
        pathMls: "x/mls.jpg",
        createdAt: new Date().toISOString(),
      }),
    );

    const published = await publishDelivery(order!.id, tenant.id);
    expect(published.ok).toBe(true);
    if (!published.ok) return;
    expect(published.gallery.expiresAt).toBeTruthy();

    const before = published.gallery.publicToken;
    const refreshed = await refreshGalleryLink(published.gallery.id, tenant.id);
    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) return;
    expect(refreshed.gallery.publicToken).not.toBe(before);
    expect(await getGalleryByToken(before)).toBeNull();
    expect(refreshed.gallery.expiresAt).toBeTruthy();
  });

  it("returns 410 for expired gallery tokens", async () => {
    const tenant = await getTenant("eric-guan");
    const booked = await createBooking(tenant, bookingFixture(tenant));
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const { getOrder } = await import("@/lib/orders");
    const order = await getOrder(booked.orderId, tenant.id);
    const gallery = await ensureGalleryForOrder(order!, tenant);

    const { getDb, qRun, schema } = await import("@/lib/db");
    const { eq } = await import("drizzle-orm");
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await qRun(
      getDb()
        .update(schema.galleries)
        .set({ expiresAt: past })
        .where(eq(schema.galleries.id, gallery.id)),
    );

    const live = await getGalleryById(gallery.id);
    expect(live?.expiresAt).toBe(past);

    const { GET } = await import("@/app/api/g/[token]/media/[assetId]/route");
    const response = await GET(
      new Request(`http://localhost:3000/api/g/${gallery.publicToken}/media/x?v=proof`),
      { params: Promise.resolve({ token: gallery.publicToken, assetId: "x" }) },
    );
    expect(response.status).toBe(410);
  });
});
