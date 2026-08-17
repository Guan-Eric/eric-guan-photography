import { and, asc, desc, eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { getDb, qAll, qGet, qRun, schema } from "@/lib/db";
import type { Gallery, GalleryState, MediaAsset, Order, TrustTier } from "@/lib/db/schema";
import { processUpload } from "@/lib/media-process";
import { ensureGalleryDir } from "@/lib/media-storage";
import { platformPublicUrl } from "@/lib/platform";
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

  if (gallery.state === "unlocked") {
    if (options?.markOrderPaid) {
      await qRun(
        db
          .update(schema.orders)
          .set({ status: "paid", updatedAt: nowIso() })
          .where(eq(schema.orders.id, gallery.orderId)),
      );
    }
    return { ok: true as const, gallery, alreadyUnlocked: true as const };
  }

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
  const payment = await qGet<{
    id: string;
    galleryId: string;
    tenantId: string;
    status: string;
  }>(
    db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.providerSessionId, sessionId)),
  );
  if (!payment) return { ok: false as const, error: "Payment not found." };

  if (payment.status !== "paid") {
    await qRun(
      db
        .update(schema.payments)
        .set({ status: "paid", updatedAt: nowIso() })
        .where(eq(schema.payments.id, payment.id)),
    );
  }

  const unlocked = await unlockGallery(payment.galleryId, { markOrderPaid: true });
  if (unlocked.ok && !("alreadyUnlocked" in unlocked && unlocked.alreadyUnlocked)) {
    const { notifyGalleryPaid } = await import("@/lib/order-notify");
    await notifyGalleryPaid({
      tenantId: payment.tenantId,
      orderId: unlocked.gallery.orderId,
      galleryToken: unlocked.gallery.publicToken,
    });
  }
  return unlocked;
}

/**
 * After Stripe Checkout return (?session_id=…), confirm payment and unlock
 * without waiting for the webhook (avoids proofing flash / stuck refresh).
 */
export async function confirmCheckoutSessionForGallery(options: {
  sessionId: string;
  galleryId: string;
  publicToken: string;
}) {
  const { getStripe } = await import("@/lib/stripe");
  const stripe = getStripe();
  if (!stripe) {
    return markPaymentPaidBySession(options.sessionId);
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(options.sessionId);
    const paid =
      session.payment_status === "paid" || session.status === "complete";
    if (!paid) {
      return { ok: false as const, error: "Payment not completed yet." };
    }
    if (
      session.metadata?.galleryId &&
      session.metadata.galleryId !== options.galleryId
    ) {
      return { ok: false as const, error: "Session does not match this gallery." };
    }
    return markPaymentPaidBySession(options.sessionId);
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Could not confirm session.",
    };
  }
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

export type GallerySummary = Pick<
  Gallery,
  "id" | "orderId" | "state" | "publicToken" | "trustTier" | "brandMode"
> & {
  mediaCount: number;
  coverAssetId: string | null;
  coverWidth: number | null;
  coverHeight: number | null;
  videoCount: number;
  tourCount: number;
  floorPlanCount: number;
};

/**
 * Board summaries in two queries instead of one `listMedia` per gallery.
 * The lowest `sortOrder` asset is the cover, matching the share-kit convention.
 */
export async function listGallerySummaries(tenantId: string): Promise<GallerySummary[]> {
  const galleries = await listRecentGalleries(tenantId);
  if (galleries.length === 0) return [];

  const db = getDb();
  const assets = await qAll<{
    id: string;
    galleryId: string;
    sortOrder: number;
    width: number;
    height: number;
  }>(
    db
      .select({
        id: schema.mediaAssets.id,
        galleryId: schema.mediaAssets.galleryId,
        sortOrder: schema.mediaAssets.sortOrder,
        width: schema.mediaAssets.width,
        height: schema.mediaAssets.height,
      })
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.tenantId, tenantId))
      .orderBy(asc(schema.mediaAssets.sortOrder)),
  );

  const counts = new Map<string, number>();
  const covers = new Map<string, { id: string; width: number; height: number; sortOrder: number }>();
  for (const asset of assets) {
    counts.set(asset.galleryId, (counts.get(asset.galleryId) ?? 0) + 1);
    const cover = covers.get(asset.galleryId);
    if (!cover || asset.sortOrder < cover.sortOrder) {
      covers.set(asset.galleryId, {
        id: asset.id,
        width: asset.width,
        height: asset.height,
        sortOrder: asset.sortOrder,
      });
    }
  }

  const links = await countMediaLinksByGallery(tenantId);

  return galleries.map((gallery) => {
    const cover = covers.get(gallery.id) ?? null;
    const kinds = links.get(gallery.id);
    return {
      id: gallery.id,
      orderId: gallery.orderId,
      state: gallery.state,
      publicToken: gallery.publicToken,
      trustTier: gallery.trustTier,
      brandMode: gallery.brandMode,
      mediaCount: counts.get(gallery.id) ?? 0,
      coverAssetId: cover?.id ?? null,
      coverWidth: cover?.width ?? null,
      coverHeight: cover?.height ?? null,
      videoCount: kinds?.video ?? 0,
      tourCount: kinds?.tour ?? 0,
      floorPlanCount: kinds?.floorplan ?? 0,
    };
  });
}

type LinkKindCounts = { video: number; tour: number; floorplan: number };

/** Embed counts per gallery; empty until media links exist for the tenant. */
async function countMediaLinksByGallery(tenantId: string) {
  const grouped = new Map<string, LinkKindCounts>();
  const db = getDb();
  const rows = await qAll<{ galleryId: string | null; kind: string }>(
    db
      .select({
        galleryId: schema.mediaLinks.galleryId,
        kind: schema.mediaLinks.kind,
      })
      .from(schema.mediaLinks)
      .where(eq(schema.mediaLinks.tenantId, tenantId)),
  );

  for (const row of rows) {
    if (!row.galleryId) continue;
    const current =
      grouped.get(row.galleryId) ?? { video: 0, tour: 0, floorplan: 0 };
    if (row.kind === "video") current.video += 1;
    else if (row.kind === "tour") current.tour += 1;
    else if (row.kind === "floorplan") current.floorplan += 1;
    grouped.set(row.galleryId, current);
  }

  return grouped;
}

export function galleryPublicUrl(
  token: string,
  brandMode?: "branded" | "unbranded",
  siteUrl?: string,
) {
  const base = siteUrl?.trim() || platformPublicUrl();
  const url = new URL(`/g/${token}`, base);
  if (brandMode === "unbranded") url.searchParams.set("brand", "off");
  return url.toString();
}
