import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb, qAll, qRun, schema } from "@/lib/db";
import type { Appointment } from "@/lib/db/schema";
import {
  createBooking,
  getOrder,
  getOrderForPublic,
  listOrders,
  listOrdersByAgentEmail,
  listTodayAppointments,
  markAppointmentMilestone,
  updateOrderAddress,
  updateOrderPrice,
  updateOrderSchedule,
  updateOrderStatus,
} from "@/lib/orders";
import { getTenant } from "@/lib/tenants";
import { bookingFixture, futurePreferredSlot } from "../helpers/booking";
import { ensureTestDb } from "../helpers/db";

describe("booking create", () => {
  beforeAll(() => {
    ensureTestDb();
  });

  it("creates an order scoped to the requesting tenant", async () => {
    const tenant = await getTenant("demo-studio");
    const before = await listOrders("demo-studio");
    const result = await createBooking(tenant, bookingFixture(tenant));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const order = await getOrder(result.orderId, "demo-studio");
    expect(order).toBeTruthy();
    expect(order!.tenantId).toBe("demo-studio");
    expect(order!.publicToken).toBe(result.publicToken);
    expect(order!.propertyAddress).toMatch(/Test Street/);

    const cross = await getOrder(result.orderId, "eric-guan");
    expect(cross).toBeNull();

    const after = await listOrders("demo-studio");
    expect(after.length).toBe(before.length + 1);
  });

  it("rejects out-of-area postal codes", async () => {
    const tenant = await getTenant("demo-studio");
    const result = await createBooking(
      tenant,
      bookingFixture(tenant, { postalCode: "M5V 2T6" }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/cover|Montréal|Montreal|service/i);
  });

  it("rejects a US ZIP outside the photographer's service area", async () => {
    const tenant = await getTenant("demo-studio");
    const result = await createBooking(
      tenant,
      bookingFixture(tenant, { postalCode: "10001" }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/cover|Montréal|Montreal|service/i);
    expect(result.error).not.toMatch(/invalid/i);
  });

  it("rejects a too-short postal code", async () => {
    const tenant = await getTenant("demo-studio");
    const result = await createBooking(
      tenant,
      bookingFixture(tenant, { postalCode: "H" }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/postal or ZIP/i);
  });

  it("updates schedule, address, price, and cancels", async () => {
    const tenant = await getTenant("eric-guan");
    const first = futurePreferredSlot();
    const second = (() => {
      const start = new Date(first.start);
      start.setUTCHours(start.getUTCHours() + 2);
      const end = new Date(start.getTime() + 60_000 * 60);
      return { start: start.toISOString(), end: end.toISOString(), label: "Second" };
    })();
    const booked = await createBooking(
      tenant,
      bookingFixture(tenant, { preferredSlots: [first, second] }),
    );
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const wrongSlot = await updateOrderSchedule(
      booked.orderId,
      { start: "2020-01-01T00:00:00.000Z", end: "2020-01-01T01:00:00.000Z" },
      tenant.id,
    );
    expect(wrongSlot.ok).toBe(false);

    const scheduled = await updateOrderSchedule(
      booked.orderId,
      { start: second.start, end: second.end },
      tenant.id,
    );
    expect(scheduled.ok).toBe(true);

    const addressed = await updateOrderAddress(
      booked.orderId,
      {
        propertyAddress: "88 Peel Street Montreal",
        postalCode: "H3C 2G1",
        city: "Montreal",
      },
      tenant.id,
    );
    expect(addressed.ok).toBe(true);
    if (addressed.ok) expect(addressed.order.city).toBe("Montreal");

    const priced = await updateOrderPrice(booked.orderId, 32100, tenant.id);
    expect(priced.ok).toBe(true);
    if (priced.ok) expect(priced.order.priceCents).toBe(32100);

    const publicOrder = await getOrderForPublic(booked.orderId, booked.publicToken);
    expect(publicOrder?.id).toBe(booked.orderId);
    expect(await getOrderForPublic(booked.orderId, "bad-token")).toBeNull();

    const byAgent = await listOrdersByAgentEmail(
      tenant.id,
      (await getOrder(booked.orderId, tenant.id))!.agentEmail,
    );
    expect(byAgent.some((row) => row.id === booked.orderId)).toBe(true);

    const cancelled = await updateOrderStatus(booked.orderId, "cancelled", tenant.id);
    expect(cancelled.ok).toBe(true);
  });

  it("rejects invalid packages, slot counts, and mismatched durations", async () => {
    const tenant = await getTenant("demo-studio");
    const unknown = await createBooking(
      tenant,
      bookingFixture(tenant, { packageId: "nope" }),
    );
    expect(unknown.ok).toBe(false);

    const none = await createBooking(
      tenant,
      bookingFixture(tenant, { preferredSlots: [] }),
    );
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.error).toMatch(/1 to 3/i);

    const tooMany = await createBooking(
      tenant,
      bookingFixture(tenant, {
        preferredSlots: [1, 2, 3, 4].map((n) => {
          const start = new Date();
          start.setUTCDate(start.getUTCDate() + 10 + n);
          start.setUTCHours(15, 0, 0, 0);
          const end = new Date(start.getTime() + 60_000 * 60);
          return { start: start.toISOString(), end: end.toISOString(), label: `Slot ${n}` };
        }),
      }),
    );
    expect(tooMany.ok).toBe(false);

    const slot = futurePreferredSlot(60);
    const mismatch = await createBooking(
      tenant,
      bookingFixture(tenant, {
        preferredSlots: [
          {
            ...slot,
            end: new Date(new Date(slot.start).getTime() + 120 * 60_000).toISOString(),
          },
        ],
      }),
    );
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.error).toMatch(/duration/i);
  });

  it("validates status, price, and address updates", async () => {
    const tenant = await getTenant("eric-guan");
    const booked = await createBooking(tenant, bookingFixture(tenant));
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    expect((await updateOrderStatus("missing", "confirmed", tenant.id)).ok).toBe(false);
    expect(
      (await updateOrderStatus(booked.orderId, "not-a-status" as never, tenant.id)).ok,
    ).toBe(false);

    const twoSlots = await createBooking(
      tenant,
      bookingFixture(tenant, {
        preferredSlots: [
          futurePreferredSlot(60),
          (() => {
            const first = futurePreferredSlot(60);
            const start = new Date(first.start);
            start.setUTCHours(start.getUTCHours() + 3);
            return {
              start: start.toISOString(),
              end: new Date(start.getTime() + 60_000 * 60).toISOString(),
              label: "Later",
            };
          })(),
        ],
      }),
    );
    expect(twoSlots.ok).toBe(true);
    if (twoSlots.ok) {
      const blocked = await updateOrderStatus(twoSlots.orderId, "confirmed", tenant.id);
      expect(blocked.ok).toBe(false);
    }

    expect((await updateOrderPrice(booked.orderId, -1, tenant.id)).ok).toBe(false);
    expect((await updateOrderPrice("missing", 1000, tenant.id)).ok).toBe(false);
    expect((await updateOrderAddress("missing", {
      propertyAddress: "123 Main Street",
      postalCode: "H2X 1Y4",
      city: "Montreal",
    }, tenant.id)).ok).toBe(false);
    expect(
      (
        await updateOrderAddress(
          booked.orderId,
          { propertyAddress: "x", postalCode: "H2X 1Y4", city: "Montreal" },
          tenant.id,
        )
      ).ok,
    ).toBe(false);
    expect(
      (
        await updateOrderAddress(
          booked.orderId,
          { propertyAddress: "123 Main Street", postalCode: "H", city: "Montreal" },
          tenant.id,
        )
      ).ok,
    ).toBe(false);
    expect(
      (
        await updateOrderAddress(
          booked.orderId,
          { propertyAddress: "123 Main Street", postalCode: "H2X 1Y4" },
          tenant.id,
        )
      ).ok,
    ).toBe(false);

    const db = getDb();
    await qRun(
      db
        .update(schema.orders)
        .set({ preferredSlotsJson: "[]" })
        .where(eq(schema.orders.id, booked.orderId)),
    );
    const order = await getOrder(booked.orderId, tenant.id);
    const fallback = await updateOrderSchedule(
      booked.orderId,
      { start: order!.preferredStart, end: order!.preferredEnd },
      tenant.id,
    );
    expect(fallback.ok).toBe(true);
  });

  it("lists today's appointments and records milestones", async () => {
    const tenant = await getTenant("eric-guan");
    const booked = await createBooking(tenant, bookingFixture(tenant));
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const confirmed = await updateOrderStatus(booked.orderId, "confirmed", tenant.id, {
      selectedSlotStart: (await getOrder(booked.orderId, tenant.id))!.preferredStart,
    });
    expect(confirmed.ok).toBe(true);

    const again = await updateOrderStatus(booked.orderId, "confirmed", tenant.id, {
      selectedSlotStart: (await getOrder(booked.orderId, tenant.id))!.preferredStart,
    });
    expect(again.ok).toBe(true);

    const today = await listTodayAppointments(tenant.id, "America/Toronto");
    expect(Array.isArray(today)).toBe(true);

    const db = getDb();
    const rows = await qAll<Appointment>(
      db.select().from(schema.appointments).where(eq(schema.appointments.orderId, booked.orderId)),
    );
    expect(rows[0]).toBeTruthy();
    const stamped = await markAppointmentMilestone(tenant.id, rows[0]!.id, "onMyWayAt");
    expect(stamped.ok).toBe(true);
    expect((await markAppointmentMilestone(tenant.id, "missing", "arrivedAt")).ok).toBe(false);
    expect(
      (await markAppointmentMilestone("demo-studio", rows[0]!.id, "arrivedAt")).ok,
    ).toBe(false);

    await qRun(
      db
        .update(schema.appointments)
        .set({ startsAt: new Date().toISOString() })
        .where(eq(schema.appointments.id, rows[0]!.id)),
    );
    const nowToday = await listTodayAppointments(tenant.id, "UTC");
    expect(nowToday.some((row) => row.id === rows[0]!.id)).toBe(true);
  });
});
