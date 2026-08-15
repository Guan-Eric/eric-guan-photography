import { and, eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { entitlements } from "@/lib/billing";
import { getDb, qGet, qRun, schema } from "@/lib/db";
import type { ListingPage, Order } from "@/lib/db/schema";
import { getGalleryByOrderId, listMedia } from "@/lib/galleries";
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

export async function publishListingPage(order: Order) {
  const row = await getTenantRow(order.tenantId);
  if (!row) return { ok: false as const, error: "Studio not found." };
  const access = entitlements(row.plan);
  if (!access.propertyPages) {
    return { ok: false as const, skipped: true as const, error: "Property pages require Growth or Studio." };
  }

  const existing = await getListingPageByOrder(order.id, order.tenantId);
  const gallery = await getGalleryByOrderId(order.id, order.tenantId);
  const coords = existing?.mapLat
    ? { lat: existing.mapLat, lng: existing.mapLng }
    : await geocode(order.propertyAddress);

  const db = getDb();
  const publishedAt = nowIso();

  if (existing) {
    await qRun(
      db
        .update(schema.listingPages)
        .set({
          galleryId: gallery?.id ?? existing.galleryId,
          publishedAt,
          brandMode: gallery?.brandMode ?? existing.brandMode,
          updatedAt: publishedAt,
        })
        .where(eq(schema.listingPages.id, existing.id)),
    );
    return { ok: true as const, page: (await getListingPageByOrder(order.id, order.tenantId))! };
  }

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
      publishedAt,
      createdAt: publishedAt,
      updatedAt: publishedAt,
    }),
  );

  return { ok: true as const, page: (await getListingPageByOrder(order.id, order.tenantId))! };
}

export function listingPagePublicUrl(page: ListingPage, siteUrl: string) {
  return new URL(`/p/${page.slug}`, siteUrl).toString();
}

export async function listingPageMedia(page: ListingPage) {
  if (!page.galleryId) return [];
  return listMedia(page.galleryId);
}

export async function listingPageForPublic(tenantId: string, slug: string) {
  const page = await getListingPageBySlug(tenantId, slug);
  if (!page || !page.publishedAt) return null;
  const tenant = await getTenant(tenantId);
  return { page, tenant, media: await listingPageMedia(page) };
}
