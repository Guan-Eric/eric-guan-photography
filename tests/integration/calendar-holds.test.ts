import { beforeAll, describe, expect, it } from "vitest";
import { assertSlotAvailable } from "@/lib/availability";
import { createBooking, getOrder, updateOrderStatus } from "@/lib/orders";
import { getTenant } from "@/lib/tenants";
import { bookingFixture, futurePreferredSlot } from "../helpers/booking";
import { ensureTestDb } from "../helpers/db";

describe("calendar holds on booking", () => {
  beforeAll(() => {
    ensureTestDb();
  });

  it("blocks a second agent from requesting an already held time", async () => {
    const tenant = await getTenant("demo-studio");
    const duration =
      tenant.packages.find((pkg) => pkg.id === "standard")?.durationMinutes ?? 60;
    const slot = futurePreferredSlot(duration);
    const first = await createBooking(
      tenant,
      bookingFixture(tenant, { preferredSlots: [slot] }),
    );
    expect(first.ok).toBe(true);

    const second = await createBooking(
      tenant,
      bookingFixture(tenant, {
        preferredSlots: [slot],
        agentEmail: `other-${Date.now()}@example.com`,
      }),
    );
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error).toMatch(/no longer free|held/i);
  });

  it("releases the hold when the request is cancelled", async () => {
    const tenant = await getTenant("eric-guan");
    const duration =
      tenant.packages.find((pkg) => pkg.id === "standard")?.durationMinutes ?? 60;
    const slot = futurePreferredSlot(duration);
    const booked = await createBooking(
      tenant,
      bookingFixture(tenant, { preferredSlots: [slot] }),
    );
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const cancelled = await updateOrderStatus(booked.orderId, "cancelled", tenant.id);
    expect(cancelled.ok).toBe(true);

    const again = await createBooking(
      tenant,
      bookingFixture(tenant, {
        preferredSlots: [slot],
        agentEmail: `retry-${Date.now()}@example.com`,
      }),
    );
    expect(again.ok).toBe(true);
  });

  it("lets the photographer confirm the held slot", async () => {
    const tenant = await getTenant("eric-guan");
    const booked = await createBooking(tenant, bookingFixture(tenant));
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const order = await getOrder(booked.orderId, tenant.id);
    expect(order).toBeTruthy();
    const available = await assertSlotAvailable({
      tenantId: tenant.id,
      startIso: order!.preferredStart,
      endIso: order!.preferredEnd,
      excludeOrderId: order!.id,
    });
    expect(available.ok).toBe(true);

    const confirmed = await updateOrderStatus(
      booked.orderId,
      "confirmed",
      tenant.id,
      { selectedSlotStart: order!.preferredStart },
    );
    expect(confirmed.ok).toBe(true);
  });
});
