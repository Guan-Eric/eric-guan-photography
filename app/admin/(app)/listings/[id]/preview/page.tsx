import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ListingPublicView } from "@/components/listing-public-page";
import { getPhotographerSession } from "@/lib/auth";
import {
  listingLocaleForRegion,
} from "@/lib/listing-i18n";
import { listingPublicState } from "@/lib/listing-compliance";
import {
  getListingPage,
  listingPageLinks,
  listingPageMedia,
} from "@/lib/listing-pages";
import { getTenant } from "@/lib/tenants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Listing preview",
  robots: { index: false, follow: false },
};

export default async function ListingPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getPhotographerSession();
  if (!session) redirect("/login");
  if (!session.activeTenantId) redirect("/onboarding");

  const { id } = await params;
  const page = await getListingPage(id, session.activeTenantId);
  if (!page) notFound();

  const tenant = await getTenant(session.activeTenantId);
  const media = await listingPageMedia(page);
  const links = await listingPageLinks(page);
  const { state, checklistErrors } = listingPublicState(page, media);
  const locale = listingLocaleForRegion(page.complianceRegion);

  return (
    <ListingPublicView
      slug={page.slug}
      brandOff={false}
      locale={locale}
      page={page}
      tenant={tenant}
      media={media}
      links={links}
      mediaSrc={(assetId) => `/api/admin/listings/${page.id}/media/${assetId}`}
      preview
      previewChecklist={
        state === "live"
          ? undefined
          : checklistErrors.length > 0
            ? checklistErrors
            : state === "sold"
              ? ["Listing marked sold (deed signed)."]
              : state === "ended"
                ? ["Advertising window has ended."]
                : ["Page is not published."]
      }
    />
  );
}
