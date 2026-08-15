import { and, eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { getDb, qGet, qRun, schema } from "@/lib/db";
import { getTenantRow } from "@/lib/tenant-store";

const id = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);

const WINDOW_MS = 60 * 60 * 1000;
const MAX_UPLOADS_PER_WINDOW = Number(process.env.UPLOAD_RATE_LIMIT ?? "60");

export async function assertWithinStorageQuota(tenantId: string, incomingBytes: number) {
  const row = await getTenantRow(tenantId);
  if (!row) {
    return { ok: false as const, error: "Studio not found." };
  }
  if (row.storageBytesUsed + incomingBytes > row.mediaQuotaBytes) {
    return {
      ok: false as const,
      error: "Storage quota exceeded for this studio. Upgrade or archive old listings.",
    };
  }
  return { ok: true as const, row };
}

export async function assertUploadRateLimit(tenantId: string, fileCount: number) {
  const db = getDb();
  const now = Date.now();
  const existing = await qGet<{
    id: string;
    windowStartedAt: string;
    uploadCount: number;
  }>(
    db
      .select()
      .from(schema.uploadRateLimits)
      .where(eq(schema.uploadRateLimits.tenantId, tenantId)),
  );

  if (!existing) {
    await qRun(
      db.insert(schema.uploadRateLimits).values({
        id: `url_${id()}`,
        tenantId,
        windowStartedAt: new Date(now).toISOString(),
        uploadCount: fileCount,
      }),
    );
    return { ok: true as const };
  }

  const started = new Date(existing.windowStartedAt).getTime();
  if (now - started > WINDOW_MS) {
    await qRun(
      db
        .update(schema.uploadRateLimits)
        .set({
          windowStartedAt: new Date(now).toISOString(),
          uploadCount: fileCount,
        })
        .where(eq(schema.uploadRateLimits.id, existing.id)),
    );
    return { ok: true as const };
  }

  if (existing.uploadCount + fileCount > MAX_UPLOADS_PER_WINDOW) {
    return {
      ok: false as const,
      error: `Upload rate limit hit (${MAX_UPLOADS_PER_WINDOW}/hour). Try again later.`,
    };
  }

  await qRun(
    db
      .update(schema.uploadRateLimits)
      .set({ uploadCount: existing.uploadCount + fileCount })
      .where(
        and(
          eq(schema.uploadRateLimits.id, existing.id),
          eq(schema.uploadRateLimits.tenantId, tenantId),
        ),
      ),
  );

  return { ok: true as const };
}
