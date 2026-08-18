import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingPageEditor } from "@/components/listing-page-editor";
import { getPhotographerSession } from "@/lib/auth";
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
  const siteUrl = publicStudioUrl({
    slug: tenant.slug,
    domain: tenant.domain,
    siteUrl: tenant.siteUrl,
  });

  return (
    <ListingPageEditor
      pageId={page.id}
      publicUrl={`${siteUrl.replace(/\/$/, "")}/p/${page.slug}`}
      initial={{
        theme: listingTheme(page.theme),
        heroAssetId: page.heroAssetId ?? "",
        brandMode: page.brandMode,
        published: Boolean(page.publishedAt),
        captions: Object.fromEntries(
          media.map((asset) => [asset.id, asset.roomLabel ?? ""]),
        ),
      }}
      photos={media.map((asset) => ({
        id: asset.id,
        caption: asset.roomLabel ?? "",
      }))}
      propertyAddress={page.propertyAddress}
    />
  );
}
