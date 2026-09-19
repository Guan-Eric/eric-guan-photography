import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { GalleryLinkExpired } from "@/components/gallery-link-expired";
import { PublicGallery } from "@/components/public-gallery";
import { portalDevBypassAllowed } from "@/lib/agent-auth";
import { entitlements } from "@/lib/billing";
import { recordGalleryEvent } from "@/lib/gallery-analytics";
import {
  confirmCheckoutSessionForGallery,
  galleryAccessDeniedReason,
  galleryHasPaidAccess,
  getGalleryByToken,
  listMedia,
} from "@/lib/galleries";
import { suggestComplianceRegion } from "@/lib/listing-compliance";
import { getListingPageByOrder } from "@/lib/listing-pages";
import { listMediaLinksForGallery, visibleLinks } from "@/lib/media-links";
import { getOrder } from "@/lib/orders";
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
  if (!gallery || galleryAccessDeniedReason(gallery)) {
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

  // Stripe return may arrive after token rotation (webhook) — confirm by session first.
  if (
    typeof query.session_id === "string" &&
    query.session_id.startsWith("cs_")
  ) {
    const confirmed = await confirmCheckoutSessionForGallery({
      sessionId: query.session_id,
    });
    if (confirmed.ok) {
      const nextToken = confirmed.gallery.publicToken;
      if (nextToken !== token || query.paid !== "1") {
        const brand = query.brand === "off" ? "&brand=off" : "";
        redirect(`/g/${nextToken}?paid=1${brand}`);
      }
    }
  }

  const gallery = await getGalleryByToken(token);
  const denied = galleryAccessDeniedReason(gallery);
  if (denied === "not_found") notFound();
  if (denied === "expired" || denied === "revoked") {
    return <GalleryLinkExpired />;
  }

  const paidAccess = await galleryHasPaidAccess(gallery!);

  await recordGalleryEvent({
    tenantId: gallery!.tenantId,
    galleryId: gallery!.id,
    orderId: gallery!.orderId,
    kind: "view",
  });

  const tenant = await getTenant(gallery!.tenantId);
  const row = await getTenantRow(gallery!.tenantId);
  const media = await listMedia(gallery!.id);
  const branded = query.brand !== "off" && gallery!.brandMode !== "unbranded";
  const embeds = visibleLinks(
    await listMediaLinksForGallery(gallery!.id),
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

  const order = await getOrder(gallery!.orderId, gallery!.tenantId);
  const preferFrenchLicense =
    suggestComplianceRegion(order?.postalCode) === "ca_qc";
  const listingPage = order
    ? await getListingPageByOrder(order.id, gallery!.tenantId)
    : null;
  const listingsHref = listingPage
    ? `/portal/listings/${listingPage.id}`
    : "/portal";

  return (
    <PublicGallery
      token={token}
      title={gallery!.title}
      propertyAddress={gallery!.propertyAddress}
      amountCents={gallery!.amountCents}
      currency={gallery!.currency}
      state={paidAccess ? "unlocked" : "proofing"}
      branded={branded}
      studioName={tenant.studioName}
      photographerName={tenant.photographerName}
      licenseAccepted={Boolean(gallery!.licenseAcceptedAt)}
      preferFrenchLicense={preferFrenchLicense}
      listingsHref={listingsHref}
      allowPortalDevBypass={portalDevBypassAllowed()}
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
