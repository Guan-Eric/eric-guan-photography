import { beforeAll, describe, expect, it } from "vitest";
import {
  deactivateLicense,
  tierToPlan,
  upsertLicenseFromWebhook,
  verifyWebhookSignature,
} from "@/lib/appsumo";
import { hasActiveAccess } from "@/lib/billing";
import { PLAN_DEFS } from "@/lib/plan-defs";
import { getTenantRow } from "@/lib/tenant-store";
import { ensureTestDb } from "../helpers/db";

describe("appsumo unit", () => {
  beforeAll(() => {
    ensureTestDb();
  });

  it("maps tiers to starter/growth/studio", () => {
    expect(tierToPlan(1)).toBe("starter");
    expect(tierToPlan(2)).toBe("growth");
    expect(tierToPlan(3)).toBe("studio");
    expect(tierToPlan(99)).toBe("studio");
  });

  it("verifies HMAC signature of timestamp + body", async () => {
    process.env.APPSUMO_API_KEY = "test-appsumo-api-key";
    const body = JSON.stringify({ event: "purchase", test: true });
    const timestamp = "1318781876406";
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(process.env.APPSUMO_API_KEY),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBuf = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${timestamp}${body}`),
    );
    const signature = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const ok = await verifyWebhookSignature(body, timestamp, signature);
    expect(ok).toEqual({ ok: true });

    const bad = await verifyWebhookSignature(body, timestamp, "deadbeef");
    expect(bad.ok).toBe(false);

    delete process.env.APPSUMO_API_KEY;
    const skipped = await verifyWebhookSignature(body, timestamp, "anything");
    expect(skipped).toEqual({ ok: true });
  });

  it("swaps license key on upgrade via prev_license_key", async () => {
    const oldKey = "11111111-aaaa-bbbb-cccc-000000000001";
    const newKey = "22222222-aaaa-bbbb-cccc-000000000002";
    await upsertLicenseFromWebhook({
      license_key: oldKey,
      event: "purchase",
      license_status: "inactive",
      tier: 1,
    });
    const upgraded = await upsertLicenseFromWebhook({
      license_key: newKey,
      prev_license_key: oldKey,
      event: "upgrade",
      license_status: "inactive",
      tier: 2,
    });
    expect(upgraded.ok).toBe(true);
    if (!upgraded.ok) return;
    expect(upgraded.license?.licenseKey).toBe(newKey);
    expect(upgraded.license?.prevLicenseKey).toBe(oldKey);
    expect(upgraded.license?.tier).toBe(2);
  });

  it("deactivate clears access for a linked tenant", async () => {
    const key = "33333333-aaaa-bbbb-cccc-000000000003";
    await upsertLicenseFromWebhook({
      license_key: key,
      event: "activate",
      license_status: "inactive",
      tier: 1,
    });
    const { applyLicenseToTenant } = await import("@/lib/appsumo");
    await applyLicenseToTenant(key, "demo-studio", { userId: "user_demo" });
    let row = await getTenantRow("demo-studio");
    expect(row?.plan).toBe("starter");
    expect(row?.listingQuotaAnnual).toBe(PLAN_DEFS.starter.listingQuota);
    expect(hasActiveAccess(row!)).toBe(true);

    await deactivateLicense(key);
    row = await getTenantRow("demo-studio");
    expect(row?.plan).toBe("trial");
    expect(row?.subscriptionStatus).toBe("canceled");
    expect(hasActiveAccess(row!)).toBe(false);
  });
});
