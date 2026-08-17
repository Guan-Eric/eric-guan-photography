import { beforeAll, describe, expect, it } from "vitest";
import { createBooking, getOrder, listOrders } from "@/lib/orders";
import { getTenant } from "@/lib/tenants";
import { bookingFixture } from "../helpers/booking";
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
  });
});
