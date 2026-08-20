import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { getDb, qRun, schema } from "@/lib/db";
import { getTenantRowByStripeCustomer, markSubscriptionPastDue } from "@/lib/billing";
import { ensureTestDb } from "../helpers/db";

describe("stripe webhook", () => {
  beforeAll(() => {
    ensureTestDb();
  });

  it("rejects requests without stripe-signature when Stripe is configured", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_webhook";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    vi.resetModules();
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(response.status).toBe(501);
    const json = (await response.json()) as { ok: boolean; error?: string };
    expect(json.ok).toBe(false);
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("marks subscription past_due on invoice.payment_failed helper", async () => {
    const db = getDb();
    await qRun(
      db
        .update(schema.tenants)
        .set({
          stripeCustomerId: "cus_test_past_due",
          subscriptionStatus: "active",
        })
        .where(eq(schema.tenants.id, "demo-studio")),
    );

    const result = await markSubscriptionPastDue("cus_test_past_due");
    expect(result.ok).toBe(true);
    const row = await getTenantRowByStripeCustomer("cus_test_past_due");
    expect(row?.subscriptionStatus).toBe("past_due");
  });
});
