import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { assertCanCreateListing } from "@/lib/billing";
import { getDb, qGet, qRun, schema } from "@/lib/db";
import { assertUploadRateLimit, assertWithinStorageQuota } from "@/lib/quotas";
import { getTenant } from "@/lib/tenants";
import { ensureTestDb } from "../helpers/db";

describe("quotas", () => {
  beforeAll(() => {
    ensureTestDb();
  });

  it("allows listing creation and upload windows for a seeded studio", async () => {
    const tenant = await getTenant("eric-guan");
    const listing = await assertCanCreateListing(tenant.id);
    expect(listing.ok).toBe(true);

    const storage = await assertWithinStorageQuota(tenant.id, 1024);
    expect(storage.ok).toBe(true);

    const missing = await assertWithinStorageQuota("no-such-studio", 1);
    expect(missing.ok).toBe(false);

    const first = await assertUploadRateLimit(tenant.id, 1);
    expect(first.ok).toBe(true);
    const second = await assertUploadRateLimit(tenant.id, 1);
    expect(second.ok).toBe(true);
  });

  it("rejects storage overage and resets or blocks the upload window", async () => {
    const tenant = await getTenant("demo-studio");
    const db = getDb();
    const original = await qGet<{ mediaQuotaBytes: number }>(
      db
        .select({ mediaQuotaBytes: schema.tenants.mediaQuotaBytes })
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenant.id)),
    );
    try {
      await qRun(
        db
          .update(schema.tenants)
          .set({ mediaQuotaBytes: 1, storageBytesUsed: 0 })
          .where(eq(schema.tenants.id, tenant.id)),
      );
      const exceeded = await assertWithinStorageQuota(tenant.id, 100);
      expect(exceeded.ok).toBe(false);
    } finally {
      await qRun(
        db
          .update(schema.tenants)
          .set({ mediaQuotaBytes: original!.mediaQuotaBytes })
          .where(eq(schema.tenants.id, tenant.id)),
      );
    }

    const opened = await assertUploadRateLimit(tenant.id, 1);
    expect(opened.ok).toBe(true);
    const existing = await qGet<{ id: string }>(
      db
        .select({ id: schema.uploadRateLimits.id })
        .from(schema.uploadRateLimits)
        .where(eq(schema.uploadRateLimits.tenantId, tenant.id)),
    );
    expect(existing).toBeTruthy();
    await qRun(
      db
        .update(schema.uploadRateLimits)
        .set({
          windowStartedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          uploadCount: 50,
        })
        .where(eq(schema.uploadRateLimits.id, existing!.id)),
    );
    const reset = await assertUploadRateLimit(tenant.id, 2);
    expect(reset.ok).toBe(true);

    await qRun(
      db
        .update(schema.uploadRateLimits)
        .set({
          windowStartedAt: new Date().toISOString(),
          uploadCount: 60,
        })
        .where(eq(schema.uploadRateLimits.id, existing!.id)),
    );
    const blocked = await assertUploadRateLimit(tenant.id, 1);
    expect(blocked.ok).toBe(false);
  });
});
