import { and, eq, sql } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { getDb, qGet, qRun, schema } from "@/lib/db";

const id = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 14);

export async function recordGalleryEvent(options: {
  tenantId: string;
  galleryId: string;
  orderId: string;
  kind: "view" | "download";
}) {
  const db = getDb();
  await qRun(
    db.insert(schema.galleryEvents).values({
      id: `gev_${id()}`,
      tenantId: options.tenantId,
      galleryId: options.galleryId,
      orderId: options.orderId,
      kind: options.kind,
      createdAt: new Date().toISOString(),
    }),
  );
}

export async function galleryReport(galleryId: string, tenantId: string) {
  const db = getDb();
  const views = await qGet<{ count: number }>(
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.galleryEvents)
      .where(
        and(
          eq(schema.galleryEvents.galleryId, galleryId),
          eq(schema.galleryEvents.tenantId, tenantId),
          eq(schema.galleryEvents.kind, "view"),
        ),
      ),
  );
  const downloads = await qGet<{ count: number }>(
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.galleryEvents)
      .where(
        and(
          eq(schema.galleryEvents.galleryId, galleryId),
          eq(schema.galleryEvents.tenantId, tenantId),
          eq(schema.galleryEvents.kind, "download"),
        ),
      ),
  );
  return {
    views: Number(views?.count ?? 0),
    downloads: Number(downloads?.count ?? 0),
  };
}
