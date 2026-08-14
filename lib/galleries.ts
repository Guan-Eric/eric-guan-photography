import { and, asc, desc, eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { getDb, schema } from "@/lib/db";
import type { Gallery, GalleryState, MediaAsset, Order, TrustTier } from "@/lib/db/schema";
import { processUpload } from "@/lib/media-process";
import { ensureGalleryDir } from "@/lib/media-storage";
import type { Tenant } from "@/lib/tenant-schema";

const galleryId = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 10);
const tokenId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 28);
const assetNano = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 14);
const paymentId = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 12);

function nowIso() {
  return new Date().toISOString();
}

export function resolveTrustTier(tenantId: string, agentEmail: string): TrustTier {
  const db = getDb();
  const priorPaid = db
    .select()
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.tenantId, tenantId),
        eq(schema.orders.agentEmail, agentEmail.toLowerCase()),
        eq(schema.orders.status, "paid"),
      ),
    )
    .all();

  return priorPaid.length > 0 ? "net7" : "pay_first";
}

export function getGalleryByToken(token: string) {
  const db = getDb();
  return (
    db
      .select()
      .from(schema.galleries)
      .where(eq(schema.galleries.publicToken, token))
      .get() ?? null
  );
}

export function getGalleryByOrderId(orderId: string, tenantId?: string) {
  const db = getDb();
  const gallery =
    db
      .select()
      .from(schema.galleries)
      .where(eq(schema.galleries.orderId, orderId))
      .get() ?? null;
  if (!gallery) return null;
  if (tenantId && gallery.tenantId !== tenantId) return null;
  return gallery;
}

export function getGalleryById(galleryIdValue: string, tenantId?: string) {
  const db = getDb();
  const gallery =
    db
      .select()
      .from(schema.galleries)
      .where(eq(schema.galleries.id, galleryIdValue))
      .get() ?? null;
  if (!gallery) return null;
  if (tenantId && gallery.tenantId !== tenantId) return null;
  return gallery;
}

export function listMedia(galleryIdValue: string): MediaAsset[] {
  const db = getDb();
  return db
    .select()
    .from(schema.mediaAssets)
    .where(eq(schema.mediaAssets.galleryId, galleryIdValue))
    .orderBy(asc(schema.mediaAssets.sortOrder))
    .all();
}

export async function ensureGalleryForOrder(order: Order, tenant: Tenant) {
  const existing = getGalleryByOrderId(order.id);
  if (existing) return existing;

  const db = getDb();
  const trustTier = resolveTrustTier(order.tenantId, order.agentEmail);
  const createdAt = nowIso();
  const id = `gal_${galleryId()}`;
  const state: GalleryState = trustTier === "net7" ? "unlocked" : "proofing";

  const row = {
    id,
    tenantId: order.tenantId,
    orderId: order.id,
    state,
    publicToken: tokenId(),
    brandMode: "branded" as const,
    trustTier,
    title: order.propertyAddress,
    propertyAddress: order.propertyAddress,
    amountCents: order.priceCents,
    currency: order.currency,
    unlockedAt: state === "unlocked" ? createdAt : null,
    revokedAt: null,
    createdAt,
    updatedAt: createdAt,
  };

  db.insert(schema.galleries).values(row).run();
  await ensureGalleryDir(order.tenantId, id);

  if (state === "unlocked") {
    // Net-7 agents see full files immediately on delivery publish.
  }

  void tenant;
  return getGalleryById(id)!;
}

export async function addUploadsToGallery(options: {
  tenant: Tenant;
  order: Order;
  files: Array<{ name: string; buffer: Buffer }>;
}) {
  const gallery = await ensureGalleryForOrder(options.order, options.tenant);
  const db = getDb();
  const existingCount = listMedia(gallery.id).length;
  const created: MediaAsset[] = [];

  for (let index = 0; index < options.files.length; index += 1) {
    const file = options.files[index];
    const processed = await processUpload({
      tenantId: options.tenant.id,
      galleryId: gallery.id,
      originalName: file.name,
      buffer: file.buffer,
      studioName: options.tenant.studioName,
    });

    const row = {
      id: `med_${assetNano()}`,
      tenantId: options.tenant.id,
      galleryId: gallery.id,
      orderId: options.order.id,
      sortOrder: existingCount + index,
      originalName: processed.originalName,
      roomLabel: null,
      width: processed.width,
      height: processed.height,
      bytesOriginal: processed.bytesOriginal,
      pathOriginal: processed.pathOriginal,
      pathWeb: processed.pathWeb,
      pathProof: processed.pathProof,
      pathMls: processed.pathMls,
      createdAt: nowIso(),
    };

    db.insert(schema.mediaAssets).values(row).run();
    created.push(row as MediaAsset);
  }

  return { gallery, created };
}

export function setGalleryBrandMode(
  galleryIdValue: string,
  brandMode: "branded" | "unbranded",
) {
  const db = getDb();
  db.update(schema.galleries)
    .set({ brandMode, updatedAt: nowIso() })
    .where(eq(schema.galleries.id, galleryIdValue))
    .run();
  return getGalleryById(galleryIdValue);
}

export function unlockGallery(galleryIdValue: string, options?: { markOrderPaid?: boolean }) {
  const db = getDb();
  const gallery = getGalleryById(galleryIdValue);
  if (!gallery) return { ok: false as const, error: "Gallery not found." };
  if (gallery.revokedAt) return { ok: false as const, error: "Gallery revoked." };

  const unlockedAt = nowIso();
  db.update(schema.galleries)
    .set({ state: "unlocked", unlockedAt, updatedAt: unlockedAt })
    .where(eq(schema.galleries.id, galleryIdValue))
    .run();

  if (options?.markOrderPaid) {
    db.update(schema.orders)
      .set({ status: "paid", updatedAt: unlockedAt })
      .where(eq(schema.orders.id, gallery.orderId))
      .run();
  } else {
    db.update(schema.orders)
      .set({ status: "delivered", updatedAt: unlockedAt })
      .where(eq(schema.orders.id, gallery.orderId))
      .run();
  }

  return { ok: true as const, gallery: getGalleryById(galleryIdValue)! };
}

export function revokeGallery(galleryIdValue: string) {
  const db = getDb();
  db.update(schema.galleries)
    .set({ revokedAt: nowIso(), updatedAt: nowIso() })
    .where(eq(schema.galleries.id, galleryIdValue))
    .run();
  return getGalleryById(galleryIdValue);
}

export function publishDelivery(orderId: string, tenantId?: string) {
  const db = getDb();
  const gallery = getGalleryByOrderId(orderId, tenantId);
  if (!gallery) return { ok: false as const, error: "Upload photos before publishing." };
  const media = listMedia(gallery.id);
  if (media.length === 0) {
    return { ok: false as const, error: "Upload at least one photo before publishing." };
  }

  const nextState: GalleryState =
    gallery.trustTier === "net7" ? "unlocked" : "proofing";

  db.update(schema.galleries)
    .set({
      state: nextState,
      unlockedAt: nextState === "unlocked" ? nowIso() : gallery.unlockedAt,
      updatedAt: nowIso(),
    })
    .where(eq(schema.galleries.id, gallery.id))
    .run();

  db.update(schema.orders)
    .set({
      status: nextState === "unlocked" ? "delivered" : "delivered",
      updatedAt: nowIso(),
    })
    .where(eq(schema.orders.id, orderId))
    .run();

  return { ok: true as const, gallery: getGalleryById(gallery.id)! };
}

export function createPaymentRecord(options: {
  tenantId: string;
  gallery: Gallery;
  provider: "stripe" | "local_stub";
  providerSessionId?: string;
  status?: "pending" | "paid";
}) {
  const db = getDb();
  const createdAt = nowIso();
  const row = {
    id: `pay_${paymentId()}`,
    tenantId: options.tenantId,
    galleryId: options.gallery.id,
    orderId: options.gallery.orderId,
    provider: options.provider,
    providerSessionId: options.providerSessionId ?? null,
    amountCents: options.gallery.amountCents,
    currency: options.gallery.currency,
    status: options.status ?? "pending",
    createdAt,
    updatedAt: createdAt,
  };
  db.insert(schema.payments).values(row).run();
  return row;
}

export function markPaymentPaidBySession(sessionId: string) {
  const db = getDb();
  const payment = db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.providerSessionId, sessionId))
    .get();
  if (!payment) return { ok: false as const, error: "Payment not found." };

  db.update(schema.payments)
    .set({ status: "paid", updatedAt: nowIso() })
    .where(eq(schema.payments.id, payment.id))
    .run();

  return unlockGallery(payment.galleryId, { markOrderPaid: true });
}

export function listRecentGalleries(tenantId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.galleries)
    .where(eq(schema.galleries.tenantId, tenantId))
    .orderBy(desc(schema.galleries.createdAt))
    .all();
}

export function galleryPublicUrl(
  token: string,
  brandMode?: "branded" | "unbranded",
  siteUrl?: string,
) {
  const base =
    siteUrl ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";
  const url = new URL(`/g/${token}`, base);
  if (brandMode === "unbranded") url.searchParams.set("brand", "off");
  return url.toString();
}
