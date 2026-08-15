import { and, asc, desc, eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { getDb, qAll, qGet, qRun, schema } from "@/lib/db";
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

export async function resolveTrustTier(tenantId: string, agentEmail: string): Promise<TrustTier> {
  const db = getDb();
  const priorPaid = await qAll<Order>(
    db
      .select()
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.tenantId, tenantId),
          eq(schema.orders.agentEmail, agentEmail.toLowerCase()),
          eq(schema.orders.status, "paid"),
        ),
      ),
  );

  return priorPaid.length > 0 ? "net7" : "pay_first";
}

export async function getGalleryByToken(token: string) {
  const db = getDb();
  return (
    (await qGet<Gallery>(
      db.select().from(schema.galleries).where(eq(schema.galleries.publicToken, token)),
    )) ?? null
  );
}

export async function getGalleryByOrderId(orderId: string, tenantId?: string) {
  const db = getDb();
  const gallery =
    (await qGet<Gallery>(
      db.select().from(schema.galleries).where(eq(schema.galleries.orderId, orderId)),
    )) ?? null;
  if (!gallery) return null;
  if (tenantId && gallery.tenantId !== tenantId) return null;
  return gallery;
}

export async function getGalleryById(galleryIdValue: string, tenantId?: string) {
  const db = getDb();
  const gallery =
    (await qGet<Gallery>(
      db.select().from(schema.galleries).where(eq(schema.galleries.id, galleryIdValue)),
    )) ?? null;
  if (!gallery) return null;
  if (tenantId && gallery.tenantId !== tenantId) return null;
  return gallery;
}

export async function listMedia(galleryIdValue: string): Promise<MediaAsset[]> {
  const db = getDb();
  return qAll<MediaAsset>(
    db
      .select()
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.galleryId, galleryIdValue))
      .orderBy(asc(schema.mediaAssets.sortOrder)),
  );
}

export async function ensureGalleryForOrder(order: Order, tenant: Tenant) {
  const existing = await getGalleryByOrderId(order.id);
  if (existing) return existing;

  const db = getDb();
  const trustTier = await resolveTrustTier(order.tenantId, order.agentEmail);
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

  await qRun(db.insert(schema.galleries).values(row));
  await ensureGalleryDir(order.tenantId, id);

  if (state === "unlocked") {
    // Net-7 agents see full files immediately on delivery publish.
  }

  void tenant;
  return (await getGalleryById(id))!;
}

export async function addUploadsToGallery(options: {
  tenant: Tenant;
  order: Order;
  files: Array<{ name: string; buffer: Buffer }>;
}) {
  const gallery = await ensureGalleryForOrder(options.order, options.tenant);
  const db = getDb();
  const existingCount = (await listMedia(gallery.id)).length;
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

    await qRun(db.insert(schema.mediaAssets).values(row));
    created.push(row as MediaAsset);
  }

  return { gallery, created };
}

export async function setGalleryBrandMode(
  galleryIdValue: string,
  brandMode: "branded" | "unbranded",
) {
  const db = getDb();
  await qRun(
    db
      .update(schema.galleries)
      .set({ brandMode, updatedAt: nowIso() })
      .where(eq(schema.galleries.id, galleryIdValue)),
  );
  return getGalleryById(galleryIdValue);
}

export async function unlockGallery(
  galleryIdValue: string,
  options?: { markOrderPaid?: boolean },
) {
  const db = getDb();
  const gallery = await getGalleryById(galleryIdValue);
  if (!gallery) return { ok: false as const, error: "Gallery not found." };
  if (gallery.revokedAt) return { ok: false as const, error: "Gallery revoked." };

  const unlockedAt = nowIso();
  await qRun(
    db
      .update(schema.galleries)
      .set({ state: "unlocked", unlockedAt, updatedAt: unlockedAt })
      .where(eq(schema.galleries.id, galleryIdValue)),
  );

  if (options?.markOrderPaid) {
    await qRun(
      db
        .update(schema.orders)
        .set({ status: "paid", updatedAt: unlockedAt })
        .where(eq(schema.orders.id, gallery.orderId)),
    );
  } else {
    await qRun(
      db
        .update(schema.orders)
        .set({ status: "delivered", updatedAt: unlockedAt })
        .where(eq(schema.orders.id, gallery.orderId)),
    );
  }

  return { ok: true as const, gallery: (await getGalleryById(galleryIdValue))! };
}

export async function revokeGallery(galleryIdValue: string) {
  const db = getDb();
  await qRun(
    db
      .update(schema.galleries)
      .set({ revokedAt: nowIso(), updatedAt: nowIso() })
      .where(eq(schema.galleries.id, galleryIdValue)),
  );
  return getGalleryById(galleryIdValue);
}

export async function publishDelivery(orderId: string, tenantId?: string) {
  const db = getDb();
  const gallery = await getGalleryByOrderId(orderId, tenantId);
  if (!gallery) return { ok: false as const, error: "Upload photos before publishing." };
  const media = await listMedia(gallery.id);
  if (media.length === 0) {
    return { ok: false as const, error: "Upload at least one photo before publishing." };
  }

  const nextState: GalleryState =
    gallery.trustTier === "net7" ? "unlocked" : "proofing";

  await qRun(
    db
      .update(schema.galleries)
      .set({
        state: nextState,
        unlockedAt: nextState === "unlocked" ? nowIso() : gallery.unlockedAt,
        updatedAt: nowIso(),
      })
      .where(eq(schema.galleries.id, gallery.id)),
  );

  await qRun(
    db
      .update(schema.orders)
      .set({
        status: nextState === "unlocked" ? "delivered" : "delivered",
        updatedAt: nowIso(),
      })
      .where(eq(schema.orders.id, orderId)),
  );

  return { ok: true as const, gallery: (await getGalleryById(gallery.id))! };
}

export async function createPaymentRecord(options: {
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
  await qRun(db.insert(schema.payments).values(row));
  return row;
}

export async function markPaymentPaidBySession(sessionId: string) {
  const db = getDb();
  const payment = await qGet<{ id: string; galleryId: string }>(
    db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.providerSessionId, sessionId)),
  );
  if (!payment) return { ok: false as const, error: "Payment not found." };

  await qRun(
    db
      .update(schema.payments)
      .set({ status: "paid", updatedAt: nowIso() })
      .where(eq(schema.payments.id, payment.id)),
  );

  return unlockGallery(payment.galleryId, { markOrderPaid: true });
}

export async function listRecentGalleries(tenantId: string) {
  const db = getDb();
  return qAll<Gallery>(
    db
      .select()
      .from(schema.galleries)
      .where(eq(schema.galleries.tenantId, tenantId))
      .orderBy(desc(schema.galleries.createdAt)),
  );
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
