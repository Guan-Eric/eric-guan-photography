import { beforeAll, describe, expect, it } from "vitest";
import { assertCanCreateListing } from "@/lib/billing";
import { belongsToTenant } from "@/lib/isolation";
import { getListingPageByOrder, getListingPageBySlug } from "@/lib/listing-pages";
import { createBooking, getOrder, listOrders } from "@/lib/orders";
import { getTenant } from "@/lib/tenants";
import { getTenantRow } from "@/lib/tenant-store";
import { bookingFixture } from "../helpers/booking";
import { ensureTestDb } from "../helpers/db";

describe("tenant isolation (sqlite)", () => {
  beforeAll(() => {
    ensureTestDb();
  });

  it("prevents cross-tenant order and listing reads", async () => {
    const eric = await getTenant("eric-guan");
    const booked = await createBooking(eric, bookingFixture(eric));
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const leaked = await getOrder(booked.orderId, "demo-studio");
    expect(leaked).toBeNull();

    const own = await getOrder(booked.orderId, "eric-guan");
    expect(own?.id).toBe(booked.orderId);

    const leakedPage = await getListingPageByOrder(booked.orderId, "demo-studio");
    expect(leakedPage).toBeNull();

    const missing = await getListingPageBySlug("demo-studio", "does-not-exist");
    expect(missing).toBeNull();
  });

  it("keeps seeded tenants distinct and quota scoped", async () => {
    const ericOrders = await listOrders("eric-guan");
    const demoOrders = await listOrders("demo-studio");
    expect(Array.isArray(ericOrders)).toBe(true);
    expect(Array.isArray(demoOrders)).toBe(true);

    expect(belongsToTenant("eric-guan", "demo-studio")).toBe(false);

    const ericBilling = await getTenantRow("eric-guan");
    const demoBilling = await getTenantRow("demo-studio");
    expect(ericBilling).toBeTruthy();
    expect(demoBilling).toBeTruthy();
    expect(ericBilling!.id).not.toBe(demoBilling!.id);

    const quota = await assertCanCreateListing("eric-guan");
    expect(quota.ok).toBe(true);
  });

  it("keeps listing domains and reviews tenant-scoped", async () => {
    const { listTestimonials } = await import("@/lib/reviews");
    const demoReviews = await listTestimonials("demo-studio", false);
    const ericReviews = await listTestimonials("eric-guan", false);
    expect(demoReviews.every((item) => item.tenantId === "demo-studio")).toBe(true);
    expect(ericReviews.every((item) => item.tenantId === "eric-guan")).toBe(true);

    const { getListingDomainByHostname } = await import("@/lib/domain-billing");
    const miss = await getListingDomainByHostname("not-a-real-listing.example");
    expect(miss).toBeNull();
  });
});
