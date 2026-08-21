import { beforeAll, describe, expect, it } from "vitest";
import {
  applyLicenseToTenant,
  decodePendingCookie,
  encodePendingCookie,
  getLicenseByKey,
  upsertLicenseFromWebhook,
} from "@/lib/appsumo";
import { hasActiveAccess } from "@/lib/billing";
import { PLAN_DEFS } from "@/lib/plan-defs";
import { getTenantRow } from "@/lib/tenant-store";
import { ensureTestDb } from "../helpers/db";

describe("appsumo integration", () => {
  beforeAll(() => {
    ensureTestDb();
    delete process.env.APPSUMO_API_KEY;
  });

  it("webhook test:true returns success with no license write", async () => {
    const { POST } = await import("@/app/api/appsumo/webhook/route");
    const body = JSON.stringify({
      license_key: "00000000-aaaa-1111-bbbb-abcdef012345",
      event: "purchase",
      license_status: "inactive",
      event_timestamp: 1318781876406,
      created_at: 1318738512,
      test: true,
    });
    const response = await POST(
      new Request("http://localhost/api/appsumo/webhook", {
        method: "POST",
        body,
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as { event: string; success: boolean };
    expect(json).toEqual({ event: "purchase", success: true });
    const row = await getLicenseByKey("00000000-aaaa-1111-bbbb-abcdef012345");
    expect(row).toBeUndefined();
  });

  it("activate + link applies starter quotas", async () => {
    const key = "44444444-aaaa-bbbb-cccc-000000000004";
    const { POST } = await import("@/app/api/appsumo/webhook/route");
    const response = await POST(
      new Request("http://localhost/api/appsumo/webhook", {
        method: "POST",
        body: JSON.stringify({
          license_key: key,
          event: "activate",
          license_status: "inactive",
          tier: 1,
          test: false,
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ event: "activate", success: true });

    const linked = await applyLicenseToTenant(key, "demo-studio");
    expect(linked.ok).toBe(true);
    const row = await getTenantRow("demo-studio");
    expect(row?.plan).toBe("starter");
    expect(row?.subscriptionStatus).toBe("active");
    expect(row?.listingQuotaAnnual).toBe(PLAN_DEFS.starter.listingQuota);
    expect(row?.seatsQuota).toBe(PLAN_DEFS.starter.seats);
    expect(hasActiveAccess(row!)).toBe(true);
  });

  it("deactivate webhook cancels tenant access", async () => {
    const key = "55555555-aaaa-bbbb-cccc-000000000005";
    await upsertLicenseFromWebhook({
      license_key: key,
      event: "activate",
      tier: 2,
      license_status: "inactive",
    });
    await applyLicenseToTenant(key, "demo-studio");
    expect((await getTenantRow("demo-studio"))?.plan).toBe("growth");

    const { POST } = await import("@/app/api/appsumo/webhook/route");
    const response = await POST(
      new Request("http://localhost/api/appsumo/webhook", {
        method: "POST",
        body: JSON.stringify({
          license_key: key,
          event: "deactivate",
          license_status: "active",
          test: false,
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      event: "deactivate",
      success: true,
    });

    const row = await getTenantRow("demo-studio");
    expect(row?.plan).toBe("trial");
    expect(row?.subscriptionStatus).toBe("canceled");
    expect(hasActiveAccess(row!)).toBe(false);
    expect((await getLicenseByKey(key))?.status).toBe("deactivated");
  });

  it("oauth GET without code returns 200 OK", async () => {
    const { GET } = await import("@/app/api/appsumo/oauth/route");
    const response = await GET(
      new Request("http://localhost/api/appsumo/oauth"),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
  });

  it("encodePendingCookie round-trips", () => {
    const key = "66666666-aaaa-bbbb-cccc-000000000006";
    const encoded = encodePendingCookie(key);
    expect(decodePendingCookie(encoded)).toBe(key);
    expect(decodePendingCookie(`${key}.bad`)).toBeNull();
  });
});
