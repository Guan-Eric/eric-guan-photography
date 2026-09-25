import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusPage } from "@/components/status-page";
import { enhancementLabel } from "@/lib/listing-compliance";
import { listingCopy, type ListingLocale } from "@/lib/listing-i18n";
import { listingPageForPublic } from "@/lib/listing-pages";
import { requireRequestTenant } from "@/lib/tenants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Unaltered originals — ${slug}`,
    robots: { index: false, follow: false },
  };
}

export default async function ListingOriginalsPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const tenant = await requireRequestTenant();
  const { slug } = await params;
  const data = await listingPageForPublic(tenant.id, slug);
  if (data.state === "missing" || !data.page) notFound();

  const locale: ListingLocale = data.page.complianceRegion === "ca_qc" ? "fr" : "en";
  const copy = listingCopy[locale];

  if (data.state !== "live") {
    if (data.state === "waiting_on_agent") {
      return (
        <StatusPage
          eyebrow={copy.statusWaitingEyebrow}
          title={copy.statusWaitingTitle}
          body={copy.statusWaitingBody}
          details={data.checklistErrors}
          actions={[{ href: "/portal", label: copy.statusPortalCta }]}
        />
      );
    }
    if (data.state === "sold") {
      return (
        <StatusPage
          eyebrow={copy.statusSoldEyebrow}
          title={copy.statusSoldTitle}
          body={copy.statusSoldBody}
        />
      );
    }
    if (data.state === "ended") {
      return (
        <StatusPage
          eyebrow={copy.statusEndedEyebrow}
          title={copy.statusEndedTitle}
          body={copy.statusEndedBody}
        />
      );
    }
    return (
      <StatusPage
        eyebrow={copy.statusDraftEyebrow}
        title={copy.statusDraftTitle}
        body={copy.statusDraftBody}
      />
    );
  }

  const { page, media } = data;
  const lang = locale;
  const disclosed = media.filter((asset) => asset.disclosurePublic === 1);
  const altered = media.filter((asset) => asset.enhancementTag);

  return (
    <main className="listing-page listing-originals" id="main">
      <header className="listing-copy">
        <p className="eyebrow">
          {lang === "fr" ? "Images non retouchées" : "Unaltered originals"}
        </p>
        <h1>{page.propertyAddress}</h1>
        <p className="lede">
          {lang === "fr"
            ? "Versions originales non modifiées des photos marquées comme mises en scène, générées par IA ou altérées numériquement."
            : "Original, unaltered versions of photos tagged as virtually staged, AI-generated, or digitally altered."}
        </p>
        <p>
          <Link className="text-link" href={`/p/${slug}`}>
            {lang === "fr" ? "← Retour à la fiche" : "← Back to listing"}
          </Link>
        </p>
      </header>

      {disclosed.length === 0 ? (
        <p className="muted listing-copy">
          {lang === "fr"
            ? "Aucune image originale n’est publiée pour cette fiche."
            : "No unaltered originals are published for this listing."}
        </p>
      ) : (
        <div className="delivery-grid listing-grid">
          {disclosed.map((asset) => {
            const usedBy = altered.filter(
              (row) => row.originalDisclosureAssetId === asset.id,
            );
            return (
              <figure key={asset.id} className="delivery-item">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/p/${slug}/original/${asset.id}`}
                  alt={
                    asset.roomLabel ||
                    (lang === "fr" ? "Original non modifié" : "Unaltered original")
                  }
                  width={asset.width}
                  height={asset.height}
                  loading="lazy"
                />
                <figcaption>
                  <strong>
                    {lang === "fr" ? "Original non modifié" : "Unaltered original"}
                  </strong>
                  {asset.roomLabel ? ` — ${asset.roomLabel}` : null}
                  {usedBy.length > 0 ? (
                    <span className="muted">
                      {" "}
                      (
                      {usedBy
                        .map((row) => enhancementLabel(row.enhancementTag, lang))
                        .filter(Boolean)
                        .join(", ")}
                      )
                    </span>
                  ) : null}
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}
    </main>
  );
}
