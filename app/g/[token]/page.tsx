import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicGallery } from "@/components/public-gallery";
import { entitlements } from "@/lib/billing";
import { recordGalleryEvent } from "@/lib/gallery-analytics";
import {
  confirmCheckoutSessionForGallery,
  getGalleryByToken,
  listMedia,
} from "@/lib/galleries";
import { listMediaLinksForGallery, visibleLinks } from "@/lib/media-links";
import { getTenantRow } from "@/lib/tenant-store";
import { getTenant } from "@/lib/tenants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { token: string };
type Search = {
  brand?: string;
  paid?: string;
  cancelled?: string;
  session_id?: string;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { token } = await params;
  const gallery = await getGalleryByToken(token);
  if (!gallery || gallery.revokedAt) {
    return { title: "Gallery", robots: { index: false, follow: false } };
  }
  return {
    title: gallery.title,
    description: `Listing gallery for ${gallery.propertyAddress}`,
    robots: { index: false, follow: false },
  };
}

export default async function GalleryPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { token } = await params;
  const query = await searchParams;
  let gallery = await getGalleryByToken(token);
  if (!gallery || gallery.revokedAt) notFound();

  // Stripe success return often beats the webhook — unlock from session_id here.
  if (
    gallery.state !== "unlocked" &&
    typeof query.session_id === "string" &&
    query.session_id.startsWith("cs_")
  ) {
    await confirmCheckoutSessionForGallery({
      sessionId: query.session_id,
      galleryId: gallery.id,
      publicToken: gallery.publicToken,
    });
    gallery = (await getGalleryByToken(token)) ?? gallery;
  }

  await recordGalleryEvent({
    tenantId: gallery.tenantId,
    galleryId: gallery.id,
    orderId: gallery.orderId,
    kind: "view",
  });

  const tenant = await getTenant(gallery.tenantId);
  const row = await getTenantRow(gallery.tenantId);
  const media = await listMedia(gallery.id);
  const branded = query.brand !== "off" && gallery.brandMode !== "unbranded";
  const embeds = visibleLinks(
    await listMediaLinksForGallery(gallery.id),
    branded ? "branded" : "unbranded",
  ).map((link) => ({
    id: link.id,
    kind: link.kind,
    provider: link.provider,
    url: link.url,
    title: link.title,
    docHref: link.storagePath
      ? `/api/g/${token}/doc/${link.id}${branded ? "" : "?brand=off"}`
      : null,
  }));
  const upsells =
    row && entitlements(row.plan).upsells
      ? tenant.packages
          .filter((pkg) => pkg.upsell && pkg.priceCents)
          .map((pkg) => ({
            id: pkg.id,
            name: pkg.name,
            priceCents: pkg.priceCents!,
            summary: pkg.summary,
          }))
      : [];

  return (
    <PublicGallery
      token={token}
      title={gallery.title}
      propertyAddress={gallery.propertyAddress}
      amountCents={gallery.amountCents}
      currency={gallery.currency}
      state={gallery.state}
      branded={branded}
      studioName={tenant.studioName}
      photographerName={tenant.photographerName}
      media={media.map((asset) => ({
        id: asset.id,
        originalName: asset.originalName,
        roomLabel: asset.roomLabel,
        width: asset.width,
        height: asset.height,
      }))}
      embeds={embeds}
      paidFlag={query.paid === "1"}
      cancelledFlag={query.cancelled === "1"}
      upsells={upsells}
      allowStubUnlock={
        process.env.NODE_ENV === "development" ||
        process.env.ALLOW_GALLERY_STUB_UNLOCK === "1"
      }
    />
  );
}
