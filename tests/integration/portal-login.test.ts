import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import "../helpers/next-mocks";
import {
  createAgentLoginToken,
  createAgentOtpChallenge,
  getAgentSession,
  portalDevBypassAllowed,
} from "@/lib/agent-auth";
import { ensureGalleryForOrder } from "@/lib/galleries";
import { getListingPageByOrder } from "@/lib/listing-pages";
import { createBooking, getOrder } from "@/lib/orders";
import { safePortalPath } from "@/lib/platform";
import { getTenant } from "@/lib/tenants";
import { bookingFixture } from "../helpers/booking";
import { ensureTestDb } from "../helpers/db";
import { jsonRequest, readJson } from "../helpers/http";
import {
  absorbResponseCookies,
  getCookieValue,
  resetCookieStore,
  resetRequestHeaders,
  setRequestHeaders,
} from "../helpers/next-mocks";

function studioHeaders(slug: string) {
  setRequestHeaders({
    host: `${slug}.localhost:3000`,
    "x-forwarded-host": `${slug}.localhost:3000`,
    "x-tenant-slug": slug,
    "x-platform-host": null,
  });
}

describe("agent portal OTP login", () => {
  beforeAll(() => {
    ensureTestDb();
  });

  beforeEach(() => {
    resetCookieStore();
    resetRequestHeaders();
  });

  it("keeps safePortalPath listing deep links", () => {
    expect(safePortalPath("/portal/listings/lp_1")).toBe("/portal/listings/lp_1");
  });

  it("consumes a legacy magic-link token once via callback", async () => {
    const tenant = await getTenant("eric-guan");
    const email = "jane.doe@realty.example.com";
    const token = await createAgentLoginToken(tenant.id, email);

    const { POST } = await import("@/app/api/portal/callback/route");
    const response = await POST(
      new Request("https://studiofront.workers.dev/api/portal/callback", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          host: "studiofront.workers.dev",
          "x-forwarded-host": "silentshutter.studiofront.ca",
          "x-forwarded-proto": "https",
        },
        body: new URLSearchParams({ token }).toString(),
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://silentshutter.studiofront.ca/portal",
    );
    absorbResponseCookies(response);
    expect(getCookieValue("sf_agent")).toBeTruthy();
    const session = await getAgentSession();
    expect(session).toEqual({ tenantId: tenant.id, email });
  });

  it("rejects a missing callback token", async () => {
    const { POST } = await import("@/app/api/portal/callback/route");
    const response = await POST(
      new Request("http://localhost:3000/api/portal/callback", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams().toString(),
      }),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/portal/login?error=expired");
  });

  it("returns ok for unknown emails without enumeration", async () => {
    const tenant = await getTenant("eric-guan");
    studioHeaders(tenant.slug);

    const { POST } = await import("@/app/api/portal/login/route");
    const response = await POST(
      jsonRequest("http://ericguan.localhost:3000/api/portal/login", {
        email: "nobody-here@example.com",
      }),
    );
    const json = await readJson<{ ok: boolean }>(response);
    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("verifies OTP and sets the agent session cookie", async () => {
    const tenant = await getTenant("eric-guan");
    const email = `otp-agent-${Date.now()}@example.com`;
    const booked = await createBooking(tenant, bookingFixture(tenant, { agentEmail: email }));
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    studioHeaders(tenant.slug);
    const code = await createAgentOtpChallenge(tenant.id, email);

    const { POST } = await import("@/app/api/portal/verify-otp/route");
    const response = await POST(
      jsonRequest("http://ericguan.localhost:3000/api/portal/verify-otp", {
        email,
        code,
        next: `/portal/listings/lp_test`,
      }),
    );
    const json = await readJson<{ ok: boolean; redirectTo?: string }>(response);
    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.redirectTo).toBe("/portal/listings/lp_test");
    absorbResponseCookies(response);
    expect(getCookieValue("sf_agent")).toBeTruthy();
    expect(await getAgentSession()).toEqual({ tenantId: tenant.id, email });
  });
});

describe("portal gallery deep-link + local bypass", () => {
  beforeAll(() => {
    ensureTestDb();
  });

  beforeEach(() => {
    resetCookieStore();
    resetRequestHeaders();
  });

  it("resolves listing editor path for an order with a listing page", async () => {
    const tenant = await getTenant("eric-guan");
    const email = `deeplink-${Date.now()}@example.com`;
    const booked = await createBooking(tenant, bookingFixture(tenant, { agentEmail: email }));
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const order = await getOrder(booked.orderId, tenant.id);
    expect(order).toBeTruthy();
    await ensureGalleryForOrder(order!, tenant);

    // Booking creates a listing page for delivered? ensure via getListingPageByOrder after backfill path
    // createBooking may already create listing page — check either way
    const { getDb, qRun, schema } = await import("@/lib/db");
    let listing = await getListingPageByOrder(order!.id, tenant.id);
    if (!listing) {
      const now = new Date().toISOString();
      const id = `lp_dl_${Date.now()}`;
      await qRun(
        getDb()
          .insert(schema.listingPages)
          .values({
            id,
            tenantId: tenant.id,
            orderId: order!.id,
            galleryId: null,
            slug: `deeplink-${Date.now()}`,
            brandMode: "branded",
            title: order!.propertyAddress,
            propertyAddress: order!.propertyAddress,
            agentName: order!.agentName,
            agentEmail: order!.agentEmail,
            agentPhone: null,
            brokerage: null,
            mapLat: null,
            mapLng: null,
            publishedAt: null,
            createdAt: now,
            updatedAt: now,
          }),
      );
      listing = await getListingPageByOrder(order!.id, tenant.id);
    }
    expect(listing).toBeTruthy();
    expect(safePortalPath(`/portal/listings/${listing!.id}`)).toBe(
      `/portal/listings/${listing!.id}`,
    );
  });

  it("dev-bypass sets session and redirects to the listing editor", async () => {
    const prevAllow = process.env.ALLOW_PORTAL_DEV_BYPASS;
    process.env.ALLOW_PORTAL_DEV_BYPASS = "1";
    expect(portalDevBypassAllowed()).toBe(true);

    const tenant = await getTenant("eric-guan");
    const email = `bypass-${Date.now()}@example.com`;
    const booked = await createBooking(tenant, bookingFixture(tenant, { agentEmail: email }));
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const order = await getOrder(booked.orderId, tenant.id);
    const gallery = await ensureGalleryForOrder(order!, tenant);

    const { getDb, qRun, schema } = await import("@/lib/db");
    let listing = await getListingPageByOrder(order!.id, tenant.id);
    if (!listing) {
      const now = new Date().toISOString();
      const id = `lp_by_${Date.now()}`;
      await qRun(
        getDb()
          .insert(schema.listingPages)
          .values({
            id,
            tenantId: tenant.id,
            orderId: order!.id,
            galleryId: gallery.id,
            slug: `bypass-${Date.now()}`,
            brandMode: "branded",
            title: order!.propertyAddress,
            propertyAddress: order!.propertyAddress,
            agentName: order!.agentName,
            agentEmail: order!.agentEmail,
            agentPhone: null,
            brokerage: null,
            mapLat: null,
            mapLng: null,
            publishedAt: null,
            createdAt: now,
            updatedAt: now,
          }),
      );
      listing = await getListingPageByOrder(order!.id, tenant.id);
    }

    studioHeaders(tenant.slug);
    const { POST } = await import("@/app/api/portal/dev-bypass/route");
    const response = await POST(
      new Request("http://ericguan.localhost:3000/api/portal/dev-bypass", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          host: `${tenant.slug}.localhost:3000`,
          "x-forwarded-host": `${tenant.slug}.localhost:3000`,
        },
        body: new URLSearchParams({ galleryToken: gallery.publicToken }).toString(),
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain(`/portal/listings/${listing!.id}`);
    absorbResponseCookies(response);
    expect(await getAgentSession()).toEqual({ tenantId: tenant.id, email });

    process.env.ALLOW_PORTAL_DEV_BYPASS = prevAllow;
  });
});
