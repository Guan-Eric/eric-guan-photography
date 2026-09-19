import { and, desc, eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { entitlements } from "@/lib/billing";
import { getDb, qAll, qGet, qRun, schema } from "@/lib/db";
import type {
  AgencyLicenseType,
  BrokerLicenseType,
  ComplianceRegion,
  ListingPage,
  ListingStatus,
  Order,
} from "@/lib/db/schema";
import { getGalleryByOrderId, listMedia, updateMediaCaptions, updateMediaEnhancementTags } from "@/lib/galleries";
import type { ListingSection, OpenHouse } from "@/lib/listing-content";
import {
  assertListingPublishReady,
  defaultAdvertisingEndsAt,
  listingIsPubliclyLive,
  suggestComplianceRegion,
} from "@/lib/listing-compliance";
import { type ListingTheme, listingTheme } from "@/lib/listing-themes";
import { listMediaLinksForOrder, visibleLinks } from "@/lib/media-links";
import { getOrder } from "@/lib/orders";
import { getTenantRow } from "@/lib/tenant-store";
import { getTenant } from "@/lib/tenants";

const id = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);

function nowIso() {
  return new Date().toISOString();
}

export function slugifyAddress(address: string) {
  const base =
    address
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "listing";
  return base;
}

export async function getListingPageBySlug(tenantId: string, slug: string) {
  const db = getDb();
  return (
    (await qGet<ListingPage>(
      db
        .select()
        .from(schema.listingPages)
        .where(
          and(eq(schema.listingPages.tenantId, tenantId), eq(schema.listingPages.slug, slug)),
        ),
    )) ?? null
  );
}

export async function getListingPageByOrder(orderId: string, tenantId?: string) {
  const db = getDb();
  const page =
    (await qGet<ListingPage>(
      db.select().from(schema.listingPages).where(eq(schema.listingPages.orderId, orderId)),
    )) ?? null;
  if (!page) return null;
  if (tenantId && page.tenantId !== tenantId) return null;
  return page;
}

async function geocode(address: string) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Studiofront/1.0 (listing pages)" },
    });
    if (!response.ok) return { lat: null as string | null, lng: null as string | null };
    const json = (await response.json()) as Array<{ lat: string; lon: string }>;
    const hit = json[0];
    return hit ? { lat: hit.lat, lng: hit.lon } : { lat: null, lng: null };
  } catch {
    return { lat: null as string | null, lng: null as string | null };
  }
}

async function mediaForPage(page: ListingPage) {
  if (!page.galleryId) return [];
  return listMedia(page.galleryId);
}

export async function unpublishListingIfExpired(page: ListingPage) {
  if (!page.publishedAt) return page;
  if (listingIsPubliclyLive(page)) return page;
  const updatedAt = nowIso();
  const db = getDb();
  await qRun(
    db
      .update(schema.listingPages)
      .set({ publishedAt: null, updatedAt })
      .where(eq(schema.listingPages.id, page.id)),
  );
  return { ...page, publishedAt: null, updatedAt };
}

/**
 * Ensures a listing_pages row exists for a paid order. Publishes only when the
 * compliance checklist passes; otherwise leaves/creates a draft.
 * Listing sites are created after payment — not on gallery publish.
 */
export async function publishListingPage(order: Order) {
  if (order.status !== "paid") {
    return {
      ok: false as const,
      skipped: true as const,
      error: "Listing pages are created after the order is paid.",
    };
  }

  const row = await getTenantRow(order.tenantId);
  if (!row) return { ok: false as const, error: "Studio not found." };
  const access = entitlements(row.plan);
  if (!access.propertyPages) {
    return { ok: false as const, skipped: true as const, error: "Property pages are not included on Starter." };
  }

  const existing = await getListingPageByOrder(order.id, order.tenantId);
  const gallery = await getGalleryByOrderId(order.id, order.tenantId);
  const coords = existing?.mapLat
    ? { lat: existing.mapLat, lng: existing.mapLng }
    : order.mapLat && order.mapLng
      ? { lat: order.mapLat, lng: order.mapLng }
      : await geocode(order.propertyAddress);

  const db = getDb();
  const now = nowIso();
  const region =
    existing?.complianceRegion ?? suggestComplianceRegion(order.postalCode);

  let page: ListingPage;
  if (existing) {
    await qRun(
      db
        .update(schema.listingPages)
        .set({
          galleryId: gallery?.id ?? existing.galleryId,
          brandMode: gallery?.brandMode ?? existing.brandMode,
          agentName: existing.agentName || order.agentName,
          agentEmail: existing.agentEmail || order.agentEmail,
          agentPhone: existing.agentPhone ?? order.agentPhone,
          brokerage: existing.brokerage ?? order.brokerage,
          complianceRegion: existing.complianceRegion || region,
          updatedAt: now,
        })
        .where(eq(schema.listingPages.id, existing.id)),
    );
    page = (await getListingPageByOrder(order.id, order.tenantId))!;
  } else {
    let slug = slugifyAddress(order.propertyAddress);
    let attempt = 0;
    while (await getListingPageBySlug(order.tenantId, slug)) {
      attempt += 1;
      slug = `${slugifyAddress(order.propertyAddress)}-${attempt}`;
    }

    await qRun(
      db.insert(schema.listingPages).values({
        id: `lp_${id()}`,
        tenantId: order.tenantId,
        orderId: order.id,
        galleryId: gallery?.id ?? null,
        slug,
        brandMode: gallery?.brandMode ?? "branded",
        title: order.propertyAddress,
        propertyAddress: order.propertyAddress,
        agentName: order.agentName,
        agentEmail: order.agentEmail,
        agentPhone: order.agentPhone,
        brokerage: order.brokerage,
        mapLat: coords.lat,
        mapLng: coords.lng,
        complianceRegion: region,
        listingStatus: "active",
        publishedAt: null,
        createdAt: now,
        updatedAt: now,
      }),
    );
    page = (await getListingPageByOrder(order.id, order.tenantId))!;
  }

  const media = await mediaForPage(page);
  const advertisingEndsAt =
    page.advertisingEndsAt ?? defaultAdvertisingEndsAt(now, null);
  const ready = assertListingPublishReady({
    page: { ...page, advertisingEndsAt },
    media,
  });

  if (!ready.ok) {
    if (!page.advertisingEndsAt) {
      await qRun(
        db
          .update(schema.listingPages)
          .set({ advertisingEndsAt, updatedAt: now })
          .where(eq(schema.listingPages.id, page.id)),
      );
      page = { ...page, advertisingEndsAt };
    }
    return {
      ok: true as const,
      page,
      published: false as const,
      checklistErrors: ready.errors,
    };
  }

  await qRun(
    db
      .update(schema.listingPages)
      .set({
        publishedAt: page.publishedAt ?? now,
        advertisingEndsAt,
        alterationDisclaimer: ready.alterationDisclaimer ? 1 : 0,
        listingStatus: page.listingStatus || "active",
        updatedAt: now,
      })
      .where(eq(schema.listingPages.id, page.id)),
  );

  return {
    ok: true as const,
    page: (await getListingPageByOrder(order.id, order.tenantId))!,
    published: true as const,
  };
}

export async function backfillListingPages(tenantId: string) {
  const row = await getTenantRow(tenantId);
  if (!row) return;
  const access = entitlements(row.plan);
  if (!access.propertyPages) return;

  const db = getDb();
  const orders = await qAll<Order>(
    db.select().from(schema.orders).where(eq(schema.orders.tenantId, tenantId)),
  );

  for (const order of orders) {
    if (order.status !== "paid") continue;
    const existing = await getListingPageByOrder(order.id, tenantId);
    if (existing) continue;
    const gallery = await getGalleryByOrderId(order.id, tenantId);
    if (!gallery) continue;
    await publishListingPage(order);
  }
}

export async function listListingPages(tenantId: string) {
  const db = getDb();
  return qAll<ListingPage>(
    db
      .select()
      .from(schema.listingPages)
      .where(eq(schema.listingPages.tenantId, tenantId))
      .orderBy(desc(schema.listingPages.createdAt)),
  );
}

export async function getListingPage(pageId: string, tenantId: string) {
  const db = getDb();
  const page = await qGet<ListingPage>(
    db.select().from(schema.listingPages).where(eq(schema.listingPages.id, pageId)),
  );
  if (!page || page.tenantId !== tenantId) return null;
  return page;
}

export async function getListingPageForAgent(
  pageId: string,
  tenantId: string,
  email: string,
) {
  const page = await getListingPage(pageId, tenantId);
  if (!page) return null;
  const order = await getOrder(page.orderId, tenantId);
  if (!order) return null;
  if (order.agentEmail.trim().toLowerCase() !== email.trim().toLowerCase()) {
    return null;
  }
  return page;
}

export type ListingPagePatch = {
  title?: string;
  headline?: string | null;
  description?: string | null;
  theme?: ListingTheme;
  heroAssetId?: string | null;
  sections?: ListingSection[];
  openHouses?: OpenHouse[];
  leadCapture?: boolean;
  brandMode?: "branded" | "unbranded";
  published?: boolean;
  captions?: Array<{ id: string; caption: string }>;
  brokerage?: string | null;
  brokeragePhone?: string | null;
  agentPhone?: string | null;
  agentName?: string;
  complianceRegion?: ComplianceRegion;
  licenseDisplayName?: string | null;
  licenseType?: BrokerLicenseType | null;
  agencyLegalName?: string | null;
  agencyLicenseType?: AgencyLicenseType | null;
  listingStatus?: ListingStatus;
  advertisingEndsAt?: string | null;
  deedSignedAt?: string | null;
  renew?: boolean;
  mediaTags?: Array<{
    id: string;
    enhancementTag: import("@/lib/db/schema").EnhancementTag | null;
    originalDisclosureAssetId?: string | null;
    disclosurePublic?: boolean;
  }>;
};

export async function updateListingPage(
  pageId: string,
  tenantId: string,
  patch: ListingPagePatch,
) {
  const page = await getListingPage(pageId, tenantId);
  if (!page) return { ok: false as const, error: "Listing page not found." };

  const updatedAt = nowIso();
  const values: Record<string, unknown> = { updatedAt };
  if (patch.title !== undefined) values.title = patch.title.trim() || page.title;
  if (patch.headline !== undefined) {
    const headline = patch.headline?.trim() || null;
    values.headline = headline;
    values.title = headline || page.propertyAddress;
  }
  if (patch.description !== undefined) {
    values.description = patch.description?.trim() || null;
  }
  if (patch.theme !== undefined) values.theme = listingTheme(patch.theme);
  if (patch.heroAssetId !== undefined) values.heroAssetId = patch.heroAssetId || null;
  if (patch.sections !== undefined) values.sectionsJson = JSON.stringify(patch.sections);
  if (patch.openHouses !== undefined) {
    values.openHouseJson = JSON.stringify(patch.openHouses);
  }
  if (patch.leadCapture !== undefined) values.leadCapture = patch.leadCapture ? 1 : 0;
  if (patch.brandMode !== undefined) values.brandMode = patch.brandMode;
  if (patch.brokerage !== undefined) values.brokerage = patch.brokerage?.trim() || null;
  if (patch.brokeragePhone !== undefined) {
    values.brokeragePhone = patch.brokeragePhone?.trim() || null;
  }
  if (patch.agentPhone !== undefined) values.agentPhone = patch.agentPhone?.trim() || null;
  if (patch.agentName !== undefined) values.agentName = patch.agentName.trim() || page.agentName;
  if (patch.complianceRegion !== undefined) values.complianceRegion = patch.complianceRegion;
  if (patch.licenseDisplayName !== undefined) {
    values.licenseDisplayName = patch.licenseDisplayName?.trim() || null;
  }
  if (patch.licenseType !== undefined) values.licenseType = patch.licenseType;
  if (patch.agencyLegalName !== undefined) {
    values.agencyLegalName = patch.agencyLegalName?.trim() || null;
  }
  if (patch.agencyLicenseType !== undefined) {
    values.agencyLicenseType = patch.agencyLicenseType;
  }
  if (patch.listingStatus !== undefined) values.listingStatus = patch.listingStatus;
  if (patch.advertisingEndsAt !== undefined) {
    values.advertisingEndsAt = patch.advertisingEndsAt?.trim() || null;
  }
  if (patch.deedSignedAt !== undefined) {
    values.deedSignedAt = patch.deedSignedAt?.trim() || null;
    if (patch.deedSignedAt?.trim()) {
      values.publishedAt = null;
    }
  }
  if (patch.renew) {
    values.advertisingEndsAt = defaultAdvertisingEndsAt(updatedAt, null);
    if (page.listingStatus === "sold") {
      // Renew requires an explicit status change; do not auto-reactivate sold.
    } else if (!page.publishedAt && !page.deedSignedAt) {
      // leave publish decision to patch.published
    }
  }

  const tentative = { ...page, ...values } as ListingPage;
  const media = await mediaForPage(page);
  const wantPublish = patch.published === true || (patch.published === undefined && !!page.publishedAt);

  if (patch.published === false) {
    values.publishedAt = null;
  } else if (wantPublish && !tentative.deedSignedAt) {
    const ready = assertListingPublishReady({
      page: {
        ...tentative,
        advertisingEndsAt:
          (values.advertisingEndsAt as string | null | undefined) ??
          tentative.advertisingEndsAt ??
          defaultAdvertisingEndsAt(updatedAt, null),
      },
      media,
    });
    if (!ready.ok) {
      return { ok: false as const, error: ready.errors.join(" "), checklistErrors: ready.errors };
    }
    values.publishedAt = page.publishedAt ?? updatedAt;
    values.alterationDisclaimer = ready.alterationDisclaimer ? 1 : 0;
    if (!tentative.advertisingEndsAt && !values.advertisingEndsAt) {
      values.advertisingEndsAt = defaultAdvertisingEndsAt(updatedAt, null);
    }
  }

  const db = getDb();
  await qRun(
    db.update(schema.listingPages).set(values).where(eq(schema.listingPages.id, pageId)),
  );
  if (patch.captions && page.galleryId) {
    await updateMediaCaptions(tenantId, page.galleryId, patch.captions);
  }
  if (patch.mediaTags && page.galleryId) {
    await updateMediaEnhancementTags(tenantId, page.galleryId, patch.mediaTags);
  }

  // Sync brokerage fields back to the order for share kit consistency.
  const orderSync: Record<string, unknown> = { updatedAt };
  let syncOrder = false;
  if (patch.brokerage !== undefined) {
    orderSync.brokerage = patch.brokerage?.trim() || null;
    syncOrder = true;
  }
  if (patch.agentPhone !== undefined || patch.brokeragePhone !== undefined) {
    orderSync.agentPhone =
      (patch.agentPhone ?? patch.brokeragePhone)?.trim() || page.agentPhone;
    syncOrder = true;
  }
  if (patch.agentName !== undefined) {
    orderSync.agentName = patch.agentName.trim() || page.agentName;
    syncOrder = true;
  }
  if (syncOrder) {
    await qRun(
      db
        .update(schema.orders)
        .set(orderSync)
        .where(eq(schema.orders.id, page.orderId)),
    );
  }

  return { ok: true as const, page: (await getListingPage(pageId, tenantId))! };
}

export function listingPagePublicUrl(page: ListingPage, siteUrl: string) {
  return new URL(`/p/${page.slug}`, siteUrl).toString();
}

export function listingCopyUrl(page: ListingPage, siteUrl: string) {
  return new URL(`/portal/listings/${page.id}`, siteUrl).toString();
}

export async function listingPageMedia(page: ListingPage) {
  if (!page.galleryId) return [];
  return listMedia(page.galleryId);
}

/** Video / tour / floor-plan links attached to the shoot behind this page. */
export async function listingPageLinks(page: ListingPage) {
  const links = await listMediaLinksForOrder(page.orderId, page.tenantId);
  return visibleLinks(
    links,
    page.brandMode === "unbranded" ? "unbranded" : "branded",
  );
}

export async function listingPageForPublic(tenantId: string, slug: string) {
  let page = await getListingPageBySlug(tenantId, slug);
  if (!page) return null;
  page = await unpublishListingIfExpired(page);
  if (!listingIsPubliclyLive(page)) return null;
  const tenant = await getTenant(tenantId);
  return {
    page,
    tenant,
    media: await listingPageMedia(page),
    links: await listingPageLinks(page),
  };
}
