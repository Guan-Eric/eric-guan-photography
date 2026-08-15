import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicGallery } from "@/components/public-gallery";
import { entitlements } from "@/lib/billing";
import { recordGalleryEvent } from "@/lib/gallery-analytics";
import { getGalleryByToken, listMedia } from "@/lib/galleries";
import { getTenantRow } from "@/lib/tenant-store";
import { getTenant } from "@/lib/tenants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { token: string };
type Search = { brand?: string; paid?: string; cancelled?: string };

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
  const gallery = await getGalleryByToken(token);
  if (!gallery || gallery.revokedAt) notFound();

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
