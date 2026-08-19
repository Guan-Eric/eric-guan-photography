import { beforeAll, describe, expect, it } from "vitest";
import {
  assertSlotAvailable,
  isSlotFree,
  listAvailableSlots,
} from "@/lib/availability";
import { createBooking, getOrder, updateOrderStatus } from "@/lib/orders";
import { getTenant } from "@/lib/tenants";
import { bookingFixture } from "../helpers/booking";
import { ensureTestDb } from "../helpers/db";

describe("availability slots", () => {
  beforeAll(() => {
    ensureTestDb();
  });

  it("offers future slots and rejects an invalid window", async () => {
    const tenant = await getTenant("eric-guan");
    const slots = await listAvailableSlots({
      tenantId: tenant.id,
      durationMinutes: 60,
      days: 10,
    });
    expect(slots.length).toBeGreaterThan(0);
    expect(new Date(slots[0]!.start).getTime()).toBeGreaterThan(Date.now());

    const invalid = await assertSlotAvailable({
      tenantId: tenant.id,
      startIso: "not-a-date",
      endIso: "also-bad",
    });
    expect(invalid.ok).toBe(false);

    const booked = await createBooking(tenant, bookingFixture(tenant));
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;
    const order = await getOrder(booked.orderId, tenant.id);
    const confirmed = await updateOrderStatus(order!.id, "confirmed", tenant.id, {
      selectedSlotStart: order!.preferredStart,
    });
    expect(confirmed.ok).toBe(true);

    const taken = await assertSlotAvailable({
      tenantId: tenant.id,
      startIso: order!.preferredStart,
      endIso: order!.preferredEnd,
    });
    expect(taken.ok).toBe(false);
    expect(isSlotFree(new Date(), new Date(Date.now() + 60_000), [])).toBe(true);
  });

  it("falls back to the default schedule for an unknown studio", async () => {
    const slots = await listAvailableSlots({
      tenantId: "no-such-studio",
      durationMinutes: 60,
      days: 2,
    });
    expect(Array.isArray(slots)).toBe(true);
  });
});
