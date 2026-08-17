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
});
