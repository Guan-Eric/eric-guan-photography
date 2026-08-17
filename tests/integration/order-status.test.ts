import { beforeAll, describe, expect, it } from "vitest";
import { createBooking, getOrder, updateOrderStatus } from "@/lib/orders";
import { getTenant } from "@/lib/tenants";
import { bookingFixture } from "../helpers/booking";
import { ensureTestDb } from "../helpers/db";

describe("admin order status transitions", () => {
  beforeAll(() => {
    ensureTestDb();
  });

  it("cannot skip from requested to shot", async () => {
    const tenant = await getTenant("eric-guan");
    const booked = await createBooking(tenant, bookingFixture(tenant));
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const skipped = await updateOrderStatus(booked.orderId, "shot", tenant.id);
    expect(skipped.ok).toBe(false);
  });

  it("confirms when address, price, and a preferred time are present", async () => {
    const tenant = await getTenant("eric-guan");
    const booked = await createBooking(tenant, bookingFixture(tenant));
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const order = await getOrder(booked.orderId, tenant.id);
    expect(order).toBeTruthy();
    expect(order!.priceCents).toBeGreaterThan(0);

    const confirmed = await updateOrderStatus(
      booked.orderId,
      "confirmed",
      tenant.id,
      { selectedSlotStart: order!.preferredStart },
    );
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.order.status).toBe("confirmed");

    const shot = await updateOrderStatus(booked.orderId, "shot", tenant.id);
    expect(shot.ok).toBe(true);
  });
});
