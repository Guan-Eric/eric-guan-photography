import { beforeAll, describe, expect, it } from "vitest";
import { ensureGalleryForOrder, getGalleryByToken } from "@/lib/galleries";
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

  it("unlocks via checkout stub without Stripe", async () => {
    const tenant = await getTenant("eric-guan");
    const booked = await createBooking(tenant, bookingFixture(tenant));
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const { getOrder } = await import("@/lib/orders");
    const order = await getOrder(booked.orderId, tenant.id);
    expect(order).toBeTruthy();
    const gallery = await ensureGalleryForOrder(order!, tenant);
    expect(gallery.state).not.toBe("unlocked");

    const { POST } = await import("@/app/api/g/[token]/checkout/route");
    const response = await POST(
      jsonRequest(`http://localhost:3000/api/g/${gallery.publicToken}/checkout`, {
        stub: true,
      }),
      { params: Promise.resolve({ token: gallery.publicToken }) },
    );
    const json = await readJson<{
      ok: boolean;
      stubbed?: boolean;
      unlocked?: boolean;
    }>(response);

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.stubbed).toBe(true);
    expect(json.unlocked).toBe(true);

    const refreshed = await getGalleryByToken(gallery.publicToken);
    expect(refreshed?.state).toBe("unlocked");
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
