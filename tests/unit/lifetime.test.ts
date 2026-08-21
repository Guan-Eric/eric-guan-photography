import { beforeAll, describe, expect, it } from "vitest";
import {
  applyLifetimePurchase,
  applyPlanToTenant,
  createLifetimeCheckout,
  lifetimeOfferStatus,
  meteringEnabled,
} from "@/lib/billing";
import { getTenantRow } from "@/lib/tenant-store";
import { ensureTestDb } from "../helpers/db";

describe("lifetime deal", () => {
  beforeAll(() => {
    ensureTestDb();
  });

  it("reports an open offer with starter-like caps", async () => {
    delete process.env.LTD_ENABLED;
    process.env.LTD_SEAT_CAP = "100";
    const status = await lifetimeOfferStatus();
    expect(status.enabled).toBe(true);
    expect(status.cap).toBe(100);
    expect(status.priceUsd).toBe(199);
    expect(status.listingQuota).toBe(125);
    expect(status.seats).toBe(1);
    expect(meteringEnabled("lifetime")).toBe(false);
  });

  it("applies lifetime entitlements without a subscription id", async () => {
    await applyLifetimePurchase({
      tenantId: "demo-studio",
      customerId: "cus_lifetime_test",
      sessionId: "cs_lifetime_test",
    });
    const row = await getTenantRow("demo-studio");
    expect(row?.plan).toBe("lifetime");
    expect(row?.subscriptionStatus).toBe("active");
    expect(row?.listingQuotaAnnual).toBe(125);
    expect(row?.seatsQuota).toBe(1);
    expect(row?.trialEndsAt).toBeNull();
    expect(row?.stripeCustomerId).toBe("cus_lifetime_test");

    // Restore seed plan for other suites sharing demo-studio.
    await applyPlanToTenant("demo-studio", "studio", { status: "active" });
  });

  it("stubs lifetime checkout when Stripe is off in non-production", async () => {
    const prev = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    const result = await createLifetimeCheckout({
      tenantId: "demo-studio",
      email: "demo@example.com",
      successUrl: "http://localhost/ok",
      cancelUrl: "http://localhost/cancel",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.stubbed).toBe(true);
      expect(result.plan).toBe("lifetime");
    }
    const row = await getTenantRow("demo-studio");
    expect(row?.plan).toBe("lifetime");
    await applyPlanToTenant("demo-studio", "studio", { status: "active" });
    if (prev) process.env.STRIPE_SECRET_KEY = prev;
  });
});
