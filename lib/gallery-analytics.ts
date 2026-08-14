import { and, eq, sql } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { getDb, schema } from "@/lib/db";

const id = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 14);

export function recordGalleryEvent(options: {
  tenantId: string;
  galleryId: string;
  orderId: string;
  kind: "view" | "download";
}) {
  const db = getDb();
  db.insert(schema.galleryEvents)
    .values({
      id: `gev_${id()}`,
      tenantId: options.tenantId,
      galleryId: options.galleryId,
      orderId: options.orderId,
      kind: options.kind,
      createdAt: new Date().toISOString(),
    })
    .run();
}

export function galleryReport(galleryId: string, tenantId: string) {
  const db = getDb();
  const views = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.galleryEvents)
    .where(
      and(
        eq(schema.galleryEvents.galleryId, galleryId),
        eq(schema.galleryEvents.tenantId, tenantId),
        eq(schema.galleryEvents.kind, "view"),
      ),
    )
    .get();
  const downloads = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.galleryEvents)
    .where(
      and(
        eq(schema.galleryEvents.galleryId, galleryId),
        eq(schema.galleryEvents.tenantId, tenantId),
        eq(schema.galleryEvents.kind, "download"),
      ),
    )
    .get();
  return {
    views: Number(views?.count ?? 0),
    downloads: Number(downloads?.count ?? 0),
  };
}
