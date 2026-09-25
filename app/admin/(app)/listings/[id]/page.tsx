import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingPageEditor } from "@/components/listing-page-editor";
import { getPhotographerSession } from "@/lib/auth";
import type { ComplianceRegion, ListingStatus } from "@/lib/db/schema";
import {
  listingPublicState,
  listingStateLabel,
} from "@/lib/listing-compliance";
import { getListingPage, listingPageMedia } from "@/lib/listing-pages";
import { listingTheme } from "@/lib/listing-themes";
import { publicStudioUrl } from "@/lib/platform";
import { getTenant } from "@/lib/tenants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit listing",
  robots: { index: false, follow: false },
};

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getPhotographerSession();
  if (!session?.activeTenantId) return null;

  const { id } = await params;
  const page = await getListingPage(id, session.activeTenantId);
  if (!page) notFound();

  const tenant = await getTenant(session.activeTenantId);
  const media = await listingPageMedia(page);
  const { state, checklistErrors } = listingPublicState(page, media);
  const siteUrl = publicStudioUrl({
    slug: tenant.slug,
    domain: tenant.domain,
    siteUrl: tenant.siteUrl,
  });

  return (
    <ListingPageEditor
      pageId={page.id}
      orderId={page.orderId}
      publicUrl={`${siteUrl.replace(/\/$/, "")}/p/${page.slug}`}
      previewUrl={`/admin/listings/${page.id}/preview`}
      listingState={state}
      listingStateLabel={listingStateLabel(state)}
      checklistErrors={checklistErrors}
      propertyAddress={page.propertyAddress}
      initial={{
        theme: listingTheme(page.theme),
        heroAssetId: page.heroAssetId ?? "",
        brandMode: page.brandMode,
        published: Boolean(page.publishedAt),
        leadCapture: page.leadCapture === 1,
        captions: Object.fromEntries(
          media.map((asset) => [asset.id, asset.roomLabel ?? ""]),
        ),
        brokerage: page.brokerage ?? "",
        brokeragePhone: page.brokeragePhone ?? "",
        agentPhone: page.agentPhone ?? "",
        agentName: page.agentName,
        complianceRegion: (page.complianceRegion ?? "ca_other") as ComplianceRegion,
        licenseDisplayName: page.licenseDisplayName ?? "",
        licenseType: page.licenseType ?? "",
        agencyLegalName: page.agencyLegalName ?? "",
        agencyLicenseType: page.agencyLicenseType ?? "",
        listingStatus: (page.listingStatus ?? "active") as ListingStatus,
        advertisingEndsAt: page.advertisingEndsAt
          ? page.advertisingEndsAt.slice(0, 10)
          : "",
        deedSignedAt: Boolean(page.deedSignedAt),
        photos: media.map((asset) => ({
          id: asset.id,
          caption: asset.roomLabel ?? "",
          enhancementTag: asset.enhancementTag ?? null,
          originalDisclosureAssetId: asset.originalDisclosureAssetId ?? "",
          disclosurePublic: asset.disclosurePublic === 1,
        })),
      }}
    />
  );
}
