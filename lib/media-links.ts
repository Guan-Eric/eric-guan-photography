import { and, asc, eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { getDb, qAll, qGet, qRun, schema } from "@/lib/db";
import type { MediaLink } from "@/lib/db/schema";
import { type MediaLinkKind, parseEmbed } from "@/lib/embeds";

const linkNano = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 14);

function nowIso() {
  return new Date().toISOString();
}

export type MediaLinkBrandMode = "branded" | "unbranded" | "both";

export async function listMediaLinksForGallery(galleryId: string) {
  const db = getDb();
  return qAll<MediaLink>(
    db
      .select()
      .from(schema.mediaLinks)
      .where(eq(schema.mediaLinks.galleryId, galleryId))
      .orderBy(asc(schema.mediaLinks.sortOrder)),
  );
}

export async function listMediaLinksForOrder(orderId: string, tenantId?: string) {
  const db = getDb();
  const rows = await qAll<MediaLink>(
    db
      .select()
      .from(schema.mediaLinks)
      .where(eq(schema.mediaLinks.orderId, orderId))
      .orderBy(asc(schema.mediaLinks.sortOrder)),
  );
  return tenantId ? rows.filter((row) => row.tenantId === tenantId) : rows;
}

/** Unbranded (MLS) surfaces must hide anything branded. */
export function visibleLinks(links: MediaLink[], brandMode: "branded" | "unbranded") {
  return links.filter(
    (link) => link.brandMode === "both" || link.brandMode === brandMode,
  );
}

export async function addMediaLink(options: {
  tenantId: string;
  orderId: string;
  galleryId: string | null;
  listingPageId?: string | null;
  url: string;
  kind?: MediaLinkKind;
  title?: string | null;
  brandMode?: MediaLinkBrandMode;
}) {
  const parsed = parseEmbed(options.url, options.kind ?? "video");
  if (!parsed.ok) return { ok: false as const, error: parsed.error };

  const kind = options.kind ?? parsed.embed.kind;
  const db = getDb();
  const existing = await listMediaLinksForOrder(options.orderId, options.tenantId);
  const row = {
    id: `mlk_${linkNano()}`,
    tenantId: options.tenantId,
    orderId: options.orderId,
    galleryId: options.galleryId,
    listingPageId: options.listingPageId ?? null,
    kind,
    provider: parsed.embed.provider,
    url: parsed.embed.canonicalUrl,
    storagePath: null,
    title: options.title?.trim() || null,
    sortOrder: existing.length,
    brandMode: options.brandMode ?? "both",
    createdAt: nowIso(),
  };

  await qRun(db.insert(schema.mediaLinks).values(row));
  return { ok: true as const, link: row as MediaLink };
}

/** Floor-plan PDFs live in media storage, so they carry a path instead of a url. */
export async function addMediaDocument(options: {
  tenantId: string;
  orderId: string;
  galleryId: string | null;
  storagePath: string;
  title: string;
  kind?: Extract<MediaLinkKind, "floorplan" | "doc">;
  brandMode?: MediaLinkBrandMode;
}) {
  const db = getDb();
  const existing = await listMediaLinksForOrder(options.orderId, options.tenantId);
  const row = {
    id: `mlk_${linkNano()}`,
    tenantId: options.tenantId,
    orderId: options.orderId,
    galleryId: options.galleryId,
    listingPageId: null,
    kind: options.kind ?? ("floorplan" as const),
    provider: "upload",
    url: null,
    storagePath: options.storagePath,
    title: options.title,
    sortOrder: existing.length,
    brandMode: options.brandMode ?? "both",
    createdAt: nowIso(),
  };

  await qRun(db.insert(schema.mediaLinks).values(row));
  return { ok: true as const, link: row as MediaLink };
}

export async function getMediaLink(id: string, tenantId?: string) {
  const db = getDb();
  const row = await qGet<MediaLink>(
    db.select().from(schema.mediaLinks).where(eq(schema.mediaLinks.id, id)),
  );
  if (!row) return null;
  if (tenantId && row.tenantId !== tenantId) return null;
  return row;
}

export async function deleteMediaLink(id: string, tenantId: string) {
  const db = getDb();
  await qRun(
    db
      .delete(schema.mediaLinks)
      .where(
        and(eq(schema.mediaLinks.id, id), eq(schema.mediaLinks.tenantId, tenantId)),
      ),
  );
  return { ok: true as const };
}
