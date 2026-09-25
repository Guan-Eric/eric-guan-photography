import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import "../helpers/next-mocks";
import { getDb, qRun, schema } from "@/lib/db";
import { listingCopy } from "@/lib/listing-i18n";
import {
  listingPageForPublic,
  publishListingPage,
  slugifyAddress,
  updateListingPage,
} from "@/lib/listing-pages";
import { createBooking, getOrder } from "@/lib/orders";
import { getTenant } from "@/lib/tenants";
import { bookingFixture } from "../helpers/booking";
import { ensureTestDb } from "../helpers/db";
import {
  absorbResponseCookies,
  resetCookieStore,
} from "../helpers/next-mocks";
import { jsonRequest, readJson } from "../helpers/http";

describe("listing public status + admin preview auth", () => {
  beforeAll(() => {
    ensureTestDb();
  });

  beforeEach(() => {
    resetCookieStore();
  });

  async function paidListing(address: string) {
    const tenant = await getTenant("eric-guan");
    const booked = await createBooking(
      tenant,
      bookingFixture(tenant, { propertyAddress: address }),
    );
    expect(booked.ok).toBe(true);
    if (!booked.ok) throw new Error("booking failed");
    const db = getDb();
    await qRun(
      db
        .update(schema.orders)
        .set({ status: "paid" })
        .where(eq(schema.orders.id, booked.orderId)),
    );
    const order = await getOrder(booked.orderId, tenant.id);
    const published = await publishListingPage(order!);
    expect(published.ok).toBe(true);
    if (!published.ok) throw new Error("publish failed");
    return { tenant, page: published.page };
  }

  it("returns draft, sold, and ended states with matching status copy keys", async () => {
    const stamp = Date.now();
    const { tenant, page } = await paidListing(
      `${stamp} Status Street, Montréal QC`,
    );

    await updateListingPage(page.id, tenant.id, {
      published: false,
      brokerage: "Agence Exemple",
      brokeragePhone: "514-555-0100",
      complianceRegion: "ca_other",
      advertisingEndsAt: new Date(Date.now() + 86400000 * 365).toISOString(),
    });
    const draft = await listingPageForPublic(tenant.id, page.slug);
    expect(draft.state).toBe("draft");
    expect(listingCopy.en.statusDraftTitle).toMatch(/isn’t published/i);
    expect(listingCopy.fr.statusDraftTitle).toMatch(/pas publiée/i);

    await updateListingPage(page.id, tenant.id, {
      published: true,
      brokerage: "Agence Exemple",
      brokeragePhone: "514-555-0100",
      complianceRegion: "ca_other",
      advertisingEndsAt: new Date(Date.now() + 86400000 * 365).toISOString(),
    });
    const live = await listingPageForPublic(tenant.id, page.slug);
    expect(live.state).toBe("live");

    const db = getDb();
    await qRun(
      db
        .update(schema.listingPages)
        .set({ deedSignedAt: new Date().toISOString() })
        .where(eq(schema.listingPages.id, page.id)),
    );
    const sold = await listingPageForPublic(tenant.id, page.slug);
    expect(sold.state).toBe("sold");
    expect(listingCopy.en.statusSoldTitle).toMatch(/no longer advertised/i);

    await qRun(
      db
        .update(schema.listingPages)
        .set({
          deedSignedAt: null,
          advertisingEndsAt: "2020-01-01T00:00:00.000Z",
          publishedAt: new Date().toISOString(),
        })
        .where(eq(schema.listingPages.id, page.id)),
    );
    const ended = await listingPageForPublic(tenant.id, page.slug);
    expect(ended.state).toBe("ended");
    expect(listingCopy.en.statusEndedTitle).toMatch(/advertising period/i);

    // Missing slug still reports missing (public page calls notFound).
    const missing = await listingPageForPublic(tenant.id, "no-such-slug-xyz");
    expect(missing.state).toBe("missing");
    expect(missing.page).toBeNull();
  });

  it("requires a photographer session for the admin listing preview route", async () => {
    const { default: ListingPreviewPage } = await import(
      "@/app/admin/(app)/listings/[id]/preview/page"
    );

    await expect(
      ListingPreviewPage({
        params: Promise.resolve({ id: "lp_missing_preview" }),
      }),
    ).rejects.toThrow(/NEXT_REDIRECT/);

    const { POST } = await import("@/app/api/auth/login/route");
    const login = await POST(
      jsonRequest("http://localhost:3000/api/auth/login", {
        email: "demo@example.com",
        password: process.env.ADMIN_PASSWORD ?? "dev-admin",
      }),
    );
    absorbResponseCookies(login);
    const json = await readJson<{ ok: boolean }>(login);
    expect(json.ok).toBe(true);

    const { getPhotographerSession } = await import("@/lib/auth");
    const session = await getPhotographerSession();
    expect(session?.activeTenantId).toBeTruthy();

    const stamp = Date.now();
    const tenant = await getTenant(session!.activeTenantId!);
    const booked = await createBooking(
      tenant,
      bookingFixture(tenant, {
        propertyAddress: `${stamp} Preview Street`,
      }),
    );
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;
    const db = getDb();
    await qRun(
      db
        .update(schema.orders)
        .set({ status: "paid" })
        .where(eq(schema.orders.id, booked.orderId)),
    );
    const order = await getOrder(booked.orderId, tenant.id);
    const published = await publishListingPage(order!);
    expect(published.ok).toBe(true);
    if (!published.ok) return;

    const preview = await ListingPreviewPage({
      params: Promise.resolve({ id: published.page.id }),
    });
    expect(preview).toBeTruthy();

    // Cross-tenant id is not found for the active studio.
    await expect(
      ListingPreviewPage({
        params: Promise.resolve({ id: "lp_other_tenant" }),
      }),
    ).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  });

  it("slugifyAddress still produces stable public paths for seeded streets", () => {
    expect(slugifyAddress("100 Seed Street, Montréal QC")).toMatch(/seed-street/);
  });
});
