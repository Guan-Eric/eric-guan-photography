import { and, asc, desc, eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { getDb, qAll, qGet, qRun, schema } from "@/lib/db";
import type { Gallery, GalleryState, MediaAsset, Order, TrustTier } from "@/lib/db/schema";
import { processUpload, regenerateProofForAsset } from "@/lib/media-process";
import { ensureGalleryDir } from "@/lib/media-storage";
import { platformPublicUrl } from "@/lib/platform";
import type { Tenant } from "@/lib/tenant-schema";

const galleryId = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 10);
const tokenId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 28);
const assetNano = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 14);
const paymentId = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 12);

/** Proofing and download gallery links expire after 14 days. */
export const GALLERY_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

export function galleryExpiresAtFrom(fromMs = Date.now()) {
  return new Date(fromMs + GALLERY_TOKEN_TTL_MS).toISOString();
}

export function isGalleryLinkExpired(gallery: Gallery, atMs = Date.now()) {
  if (gallery.revokedAt) return true;
  if (!gallery.expiresAt) return false;
  return new Date(gallery.expiresAt).getTime() < atMs;
}

export function galleryAccessDeniedReason(
  gallery: Gallery | null,
  atMs = Date.now(),
): "not_found" | "revoked" | "expired" | null {
  if (!gallery) return "not_found";
  if (gallery.revokedAt) return "revoked";
  if (gallery.expiresAt && new Date(gallery.expiresAt).getTime() < atMs) {
    return "expired";
  }
  return null;
}

export async function galleryHasPaidAccess(gallery: Gallery) {
  const db = getDb();
  const order = await qGet<Pick<Order, "status">>(
    db
      .select({ status: schema.orders.status })
      .from(schema.orders)
      .where(eq(schema.orders.id, gallery.orderId)),
  );
  return order?.status === "paid";
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

export async function reorderGalleryMedia(
  tenantId: string,
  galleryId: string,
  orderedIds: string[],
) {
  const existing = await listMedia(galleryId);
  if (existing.length === 0) {
    return { ok: false as const, error: "No photos to reorder." };
  }
  if (existing.some((asset) => asset.tenantId !== tenantId)) {
    return { ok: false as const, error: "Not found." };
  }
  const currentIds = existing.map((asset) => asset.id);
  const unique = new Set(orderedIds);
  if (
    orderedIds.length !== currentIds.length ||
    unique.size !== orderedIds.length ||
    orderedIds.some((id) => !currentIds.includes(id))
  ) {
    return { ok: false as const, error: "Photo list is out of date. Refresh and try again." };
  }

  const db = getDb();
  for (let index = 0; index < orderedIds.length; index += 1) {
    await qRun(
      db
        .update(schema.mediaAssets)
        .set({ sortOrder: index })
        .where(
          and(
            eq(schema.mediaAssets.id, orderedIds[index]!),
            eq(schema.mediaAssets.galleryId, galleryId),
            eq(schema.mediaAssets.tenantId, tenantId),
          ),
        ),
    );
  }
  return { ok: true as const };
}

export async function deleteMediaAsset(tenantId: string, assetId: string) {
  const db = getDb();
  const asset =
    (await qGet<MediaAsset>(
      db
        .select()
        .from(schema.mediaAssets)
        .where(
          and(eq(schema.mediaAssets.id, assetId), eq(schema.mediaAssets.tenantId, tenantId)),
        ),
    )) ?? null;
  if (!asset) return null;

  await qRun(
    db
      .delete(schema.mediaAssets)
      .where(
        and(eq(schema.mediaAssets.id, assetId), eq(schema.mediaAssets.tenantId, tenantId)),
      ),
  );
  return asset;
}

export async function updateMediaCaptions(
  tenantId: string,
  galleryId: string,
  captions: Array<{ id: string; caption: string }>,
) {
  const db = getDb();
  for (const item of captions) {
    const caption = item.caption.trim() || null;
    await qRun(
      db
        .update(schema.mediaAssets)
        .set({ roomLabel: caption })
        .where(
          and(
            eq(schema.mediaAssets.id, item.id),
            eq(schema.mediaAssets.galleryId, galleryId),
            eq(schema.mediaAssets.tenantId, tenantId),
          ),
        ),
    );
  }
}

export async function ensureGalleryForOrder(order: Order, tenant: Tenant) {
  const existing = await getGalleryByOrderId(order.id);
  if (existing) return existing;

  const db = getDb();
  const trustTier = await resolveTrustTier(order.tenantId, order.agentEmail);
  const createdAt = nowIso();
  const id = `gal_${galleryId()}`;
  const state: GalleryState = "proofing";

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
    unlockedAt: null,
    revokedAt: null,
    expiresAt: null,
    licenseAcceptedAt: null,
    licenseAcceptedLanguage: null,
    createdAt,
    updatedAt: createdAt,
  };

  await qRun(db.insert(schema.galleries).values(row));
  await ensureGalleryDir(order.tenantId, id);

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
      enhancementTag: null,
      originalDisclosureAssetId: null,
      disclosurePublic: 0,
      createdAt: nowIso(),
    };

    await qRun(db.insert(schema.mediaAssets).values(row));
    created.push(row as MediaAsset);
  }

  return { gallery, created };
}

export async function regenerateGalleryProofs(
  tenantId: string,
  galleryIdValue: string,
  studioName: string,
) {
  const gallery = await getGalleryById(galleryIdValue, tenantId);
  if (!gallery) {
    return { ok: false as const, error: "Gallery not found." };
  }
  const media = await listMedia(gallery.id);
  if (media.length === 0) {
    return { ok: false as const, error: "No photos to regenerate." };
  }

  let regenerated = 0;
  const errors: string[] = [];
  for (const asset of media) {
    try {
      await regenerateProofForAsset({
        pathOriginal: asset.pathOriginal,
        pathProof: asset.pathProof,
        studioName,
      });
      regenerated += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown watermark error.";
      errors.push(`${asset.originalName}: ${message}`);
      console.warn("[media] regenerate proof failed:", asset.id, error);
    }
  }

  if (regenerated === 0) {
    return {
      ok: false as const,
      error: errors[0] ?? "Could not regenerate watermarks.",
      regenerated: 0,
      failed: errors.length,
    };
  }

  return {
    ok: true as const,
    regenerated,
    failed: errors.length,
    errors: errors.slice(0, 5),
  };
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
  const publicToken = tokenId();
  const expiresAt = galleryExpiresAtFrom(Date.parse(unlockedAt));
  await qRun(
    db
      .update(schema.galleries)
      .set({
        state: "unlocked",
        unlockedAt,
        publicToken,
        expiresAt,
        licenseAcceptedAt: null,
        licenseAcceptedLanguage: null,
        updatedAt: unlockedAt,
      })
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

/** Rotate the public token and reset the 14-day window (proofing or unlocked). */
export async function refreshGalleryLink(galleryIdValue: string, tenantId?: string) {
  const gallery = await getGalleryById(galleryIdValue, tenantId);
  if (!gallery) return { ok: false as const, error: "Gallery not found." };
  if (gallery.revokedAt) return { ok: false as const, error: "Gallery revoked." };

  const updatedAt = nowIso();
  const publicToken = tokenId();
  const expiresAt = galleryExpiresAtFrom(Date.parse(updatedAt));
  const db = getDb();
  await qRun(
    db
      .update(schema.galleries)
      .set({
        publicToken,
        expiresAt,
        licenseAcceptedAt: null,
        licenseAcceptedLanguage: null,
        updatedAt,
      })
      .where(eq(schema.galleries.id, galleryIdValue)),
  );

  return { ok: true as const, gallery: (await getGalleryById(galleryIdValue))! };
}

export async function updateMediaEnhancementTags(
  tenantId: string,
  galleryId: string,
  updates: Array<{
    id: string;
    enhancementTag: import("@/lib/db/schema").EnhancementTag | null;
    originalDisclosureAssetId?: string | null;
    disclosurePublic?: boolean;
  }>,
) {
  const db = getDb();
  for (const item of updates) {
    const values: Record<string, unknown> = {
      enhancementTag: item.enhancementTag,
    };
    if (item.originalDisclosureAssetId !== undefined) {
      values.originalDisclosureAssetId = item.originalDisclosureAssetId?.trim() || null;
    }
    if (item.disclosurePublic !== undefined) {
      values.disclosurePublic = item.disclosurePublic ? 1 : 0;
    }
    await qRun(
      db
        .update(schema.mediaAssets)
        .set(values)
        .where(
          and(
            eq(schema.mediaAssets.id, item.id),
            eq(schema.mediaAssets.galleryId, galleryId),
            eq(schema.mediaAssets.tenantId, tenantId),
          ),
        ),
    );
  }
}

export async function acceptGalleryLicense(
  galleryIdValue: string,
  language: "en" | "fr" = "en",
) {
  const gallery = await getGalleryById(galleryIdValue);
  if (!gallery) return { ok: false as const, error: "Gallery not found." };
  if (gallery.revokedAt) return { ok: false as const, error: "Gallery revoked." };
  if (isGalleryLinkExpired(gallery)) {
    return { ok: false as const, error: "This gallery link has expired." };
  }
  if (!(await galleryHasPaidAccess(gallery))) {
    return { ok: false as const, error: "Downloads unlock after payment." };
  }
  if (gallery.licenseAcceptedAt) {
    return { ok: true as const, gallery, alreadyAccepted: true as const };
  }

  const acceptedAt = nowIso();
  const db = getDb();
  await qRun(
    db
      .update(schema.galleries)
      .set({
        licenseAcceptedAt: acceptedAt,
        licenseAcceptedLanguage: language,
        updatedAt: acceptedAt,
      })
      .where(eq(schema.galleries.id, galleryIdValue)),
  );

  return {
    ok: true as const,
    gallery: (await getGalleryById(galleryIdValue))!,
    alreadyAccepted: false as const,
  };
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

  const paid = await galleryHasPaidAccess(gallery);
  const nextState: GalleryState = paid ? "unlocked" : "proofing";
  const updatedAt = nowIso();
  const expiresAt = gallery.expiresAt ?? galleryExpiresAtFrom(Date.parse(updatedAt));

  await qRun(
    db
      .update(schema.galleries)
      .set({
        state: nextState,
        unlockedAt: nextState === "unlocked" ? gallery.unlockedAt ?? updatedAt : gallery.unlockedAt,
        expiresAt,
        updatedAt,
      })
      .where(eq(schema.galleries.id, gallery.id)),
  );

  if (!paid) {
    await qRun(
      db
        .update(schema.orders)
        .set({
          status: "delivered",
          updatedAt: nowIso(),
        })
        .where(eq(schema.orders.id, orderId)),
    );
  }

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
    orderId: string;
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

  const order = await qGet<Pick<Order, "status">>(
    db
      .select({ status: schema.orders.status })
      .from(schema.orders)
      .where(eq(schema.orders.id, payment.orderId)),
  );
  const alreadyPaid = order?.status === "paid";

  const unlocked = await unlockGallery(payment.galleryId, { markOrderPaid: true });
  if (unlocked.ok && !alreadyPaid) {
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
 * Returns the gallery with the post-unlock (rotated) token.
 */
export async function confirmCheckoutSessionForGallery(options: {
  sessionId: string;
  galleryId?: string;
  publicToken?: string;
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
      options.galleryId &&
      session.metadata?.galleryId &&
      session.metadata.galleryId !== options.galleryId
    ) {
      return { ok: false as const, error: "Session does not match this gallery." };
    }
    void options.publicToken;
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
