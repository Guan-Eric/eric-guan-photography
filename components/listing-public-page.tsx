import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingLeadForm } from "@/components/listing-lead-form";
import { ListingDomainCta } from "@/components/listing-domain-cta";
import { MediaEmbeds } from "@/components/media-embeds";
import { StatusPage } from "@/components/status-page";
import { customDomainsEnabled } from "@/lib/custom-domain";
import { TIME_ZONE } from "@/lib/availability";
import {
  formatOpenHouse,
  parseOpenHouses,
  parseSections,
} from "@/lib/listing-content";
import {
  enhancementLabel,
  type ListingPublicState,
} from "@/lib/listing-compliance";
import {
  agencyLicenseLabel,
  brokerLicenseLabel,
  listingCopy,
  type ListingLocale,
  statusBanner,
} from "@/lib/listing-i18n";
import { listingPageForPublic } from "@/lib/listing-pages";
import { getListingDomainForPage } from "@/lib/domain-billing";
import { listingTheme, listingThemeStyle } from "@/lib/listing-themes";
import type { ListingPage, MediaAsset, MediaLink } from "@/lib/db/schema";
import type { Tenant } from "@/lib/tenant-schema";
import { requireRequestTenant } from "@/lib/tenants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ListingMedia = Pick<
  MediaAsset,
  | "id"
  | "roomLabel"
  | "width"
  | "height"
  | "enhancementTag"
  | "originalDisclosureAssetId"
  | "disclosurePublic"
>;

function listingStatusPage(
  state: ListingPublicState,
  locale: ListingLocale,
  checklistErrors: string[],
) {
  const copy = listingCopy[locale];
  if (state === "waiting_on_agent") {
    return (
      <StatusPage
        eyebrow={copy.statusWaitingEyebrow}
        title={copy.statusWaitingTitle}
        body={copy.statusWaitingBody}
        details={checklistErrors}
        actions={[{ href: "/portal", label: copy.statusPortalCta }]}
      />
    );
  }
  if (state === "draft") {
    return (
      <StatusPage
        eyebrow={copy.statusDraftEyebrow}
        title={copy.statusDraftTitle}
        body={copy.statusDraftBody}
        actions={[{ href: "/portal", label: copy.statusPortalCta }]}
      />
    );
  }
  if (state === "sold") {
    return (
      <StatusPage
        eyebrow={copy.statusSoldEyebrow}
        title={copy.statusSoldTitle}
        body={copy.statusSoldBody}
      />
    );
  }
  if (state === "ended") {
    return (
      <StatusPage
        eyebrow={copy.statusEndedEyebrow}
        title={copy.statusEndedTitle}
        body={copy.statusEndedBody}
        actions={[{ href: "/portal", label: copy.statusPortalCta }]}
      />
    );
  }
  return null;
}

export async function generateListingMetadata(
  slug: string,
): Promise<Metadata> {
  const tenant = await requireRequestTenant();
  const data = await listingPageForPublic(tenant.id, slug);
  if (data.state !== "live" || !data.page) {
    return { title: "Listing", robots: { index: false, follow: false } };
  }
  return {
    title: data.page.title,
    description:
      data.page.description?.slice(0, 160) ?? `Photos of ${data.page.propertyAddress}`,
    robots: { index: false, follow: false },
  };
}

export async function ListingPublicPage({
  slug,
  brandOff,
  locale,
}: {
  slug: string;
  brandOff: boolean;
  locale: ListingLocale;
}) {
  const tenant = await requireRequestTenant();
  const data = await listingPageForPublic(tenant.id, slug);
  if (data.state === "missing" || !data.page || !data.tenant) notFound();

  if (data.state !== "live") {
    return listingStatusPage(data.state, locale, data.checklistErrors);
  }

  const listingDomain = await getListingDomainForPage(tenant.id, data.page.id);
  return (
    <ListingPublicView
      slug={slug}
      brandOff={brandOff}
      locale={locale}
      page={data.page}
      tenant={data.tenant}
      media={data.media}
      links={data.links}
      listingDomain={listingDomain}
      mediaSrc={(assetId) => `/api/p/${slug}/media/${assetId}`}
      originalSrc={(assetId) => `/api/p/${slug}/original/${assetId}`}
      originalsHref={`/p/${slug}/originals`}
      docHref={(linkId) => `/api/p/${slug}/doc/${linkId}`}
    />
  );
}

export function ListingPublicView({
  slug,
  brandOff,
  locale,
  page,
  tenant,
  media,
  links,
  listingDomain,
  mediaSrc,
  originalSrc,
  originalsHref,
  docHref,
  preview,
  previewChecklist,
}: {
  slug: string;
  brandOff: boolean;
  locale: ListingLocale;
  page: ListingPage;
  tenant: Tenant;
  media: ListingMedia[];
  links: MediaLink[];
  listingDomain?: Awaited<ReturnType<typeof getListingDomainForPage>>;
  mediaSrc: (assetId: string) => string;
  originalSrc?: (assetId: string) => string;
  originalsHref?: string | null;
  docHref?: (linkId: string) => string | null;
  preview?: boolean;
  previewChecklist?: string[];
}) {
  const copy = listingCopy[locale];
  const branded = !brandOff && page.brandMode !== "unbranded";
  const theme = listingTheme(page.theme);
  const sections = parseSections(page.sectionsJson);
  const openHouses = parseOpenHouses(page.openHouseJson);
  const hero = page.heroAssetId
    ? (media.find((asset) => asset.id === page.heroAssetId) ?? media[0])
    : media[0];
  const rest = hero ? media.filter((asset) => asset.id !== hero.id) : media;
  const phone = page.brokeragePhone || page.agentPhone;
  const agencyName = page.agencyLegalName || page.brokerage;
  const brokerName = page.licenseDisplayName || page.agentName;
  const statusText = statusBanner(page.listingStatus, locale);
  const showAlteration =
    page.alterationDisclaimer === 1 || media.some((asset) => asset.enhancementTag);
  const hasPublicOriginals = media.some((asset) => asset.disclosurePublic === 1);

  const embeds = links.map((link) => ({
    id: link.id,
    kind: link.kind,
    provider: link.provider,
    url: link.url,
    title: link.title,
    docHref:
      link.storagePath && docHref && !preview ? docHref(link.id) : null,
  }));

  const mapSrc =
    page.mapLat && page.mapLng
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${Number(page.mapLng) - 0.01}%2C${Number(page.mapLat) - 0.01}%2C${Number(page.mapLng) + 0.01}%2C${Number(page.mapLat) + 0.01}&layer=mapnik&marker=${page.mapLat}%2C${page.mapLng}`
      : null;

  function assetCaption(asset: ListingMedia) {
    const tag = enhancementLabel(asset.enhancementTag, locale);
    const parts: string[] = [];
    if (asset.roomLabel) parts.push(asset.roomLabel);
    if (tag) parts.push(tag);
    return parts.join(" · ");
  }

  function originalHref(asset: ListingMedia) {
    if (preview || !asset.enhancementTag) return null;
    if (asset.originalDisclosureAssetId && originalSrc) {
      return originalSrc(asset.originalDisclosureAssetId);
    }
    if (hasPublicOriginals && originalsHref) return originalsHref;
    return null;
  }

  return (
    <main
      className={`listing-page listing-page--${theme}`}
      id="main"
      lang={locale}
      style={listingThemeStyle(theme)}
    >
      {preview ? (
        <p className="listing-preview-banner" role="status">
          <strong>Preview — not public yet.</strong>
          {previewChecklist && previewChecklist.length > 0 ? (
            <>
              {" "}
              Still needed: {previewChecklist.join(" · ")}
            </>
          ) : (
            " Publish when you are ready."
          )}
        </p>
      ) : (
        <p className="listing-lang-switch">
          <Link className="text-link" href={copy.langSwitchHref(slug)}>
            {copy.langSwitch}
          </Link>
        </p>
      )}

      {statusText ? (
        <p className="listing-status-banner" role="status">
          {statusText}
        </p>
      ) : null}

      {showAlteration ? (
        <p className="listing-alteration-banner" role="note">
          {copy.alterationBanner}{" "}
          {!preview && hasPublicOriginals && originalsHref ? (
            <Link className="text-link" href={originalsHref}>
              {copy.viewAllOriginals}
            </Link>
          ) : null}
        </p>
      ) : null}

      <header className="listing-hero">
        {hero ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            className="listing-hero-image"
            src={mediaSrc(hero.id)}
            alt={hero.roomLabel || page.propertyAddress}
            width={hero.width}
            height={hero.height}
          />
        ) : null}
        <div className="listing-hero-copy">
          {branded ? <p className="eyebrow">{tenant.studioName}</p> : null}
          <h1>{page.headline ?? page.title}</h1>
          <p className="lede">{page.propertyAddress}</p>
          {hero?.enhancementTag ? (
            <p className="listing-image-disclosure">
              {enhancementLabel(hero.enhancementTag, locale)}
              {originalHref(hero) ? (
                <>
                  {" · "}
                  <a className="text-link" href={originalHref(hero)!}>
                    {copy.viewOriginal}
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      </header>

      {page.description ? (
        <section className="listing-copy">
          {page.description.split(/\n{2,}/).map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </section>
      ) : null}

      {rest.length > 0 ? (
        <div className="delivery-grid listing-grid">
          {rest.map((asset) => (
            <figure key={asset.id} className="delivery-item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaSrc(asset.id)}
                alt={asset.roomLabel || page.propertyAddress}
                width={asset.width}
                height={asset.height}
                loading="lazy"
              />
              {assetCaption(asset) || originalHref(asset) ? (
                <figcaption>
                  {assetCaption(asset)}
                  {originalHref(asset) ? (
                    <>
                      {assetCaption(asset) ? " · " : null}
                      <a className="text-link" href={originalHref(asset)!}>
                        {copy.viewOriginal}
                      </a>
                    </>
                  ) : null}
                </figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      ) : media.length === 0 ? (
        <div className="listing-empty">
          <p>{copy.photosPreparing}</p>
        </div>
      ) : null}

      <MediaEmbeds items={embeds} />

      {sections.map((section, index) => (
        <section key={index} className="listing-copy">
          {section.heading ? <h2>{section.heading}</h2> : null}
          {section.body.split(/\n{2,}/).map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </section>
      ))}

      {openHouses.length > 0 ? (
        <section className="listing-copy">
          <h2>{copy.openHouse}</h2>
          <ul className="listing-open-houses">
            {openHouses.map((entry, index) => (
              <li key={index}>{formatOpenHouse(entry, TIME_ZONE)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {branded ? (
        <section className="listing-agent">
          <p className="eyebrow">{copy.presentedBy}</p>
          {agencyName ? (
            <p className="listing-agency-name">
              <strong>{agencyName}</strong>
              {agencyLicenseLabel(page.agencyLicenseType, locale)
                ? ` — ${agencyLicenseLabel(page.agencyLicenseType, locale)}`
                : null}
            </p>
          ) : null}
          <h2 className="listing-broker-name">{brokerName}</h2>
          {brokerLicenseLabel(page.licenseType, locale) ? (
            <p>
              {copy.licenseType}: {brokerLicenseLabel(page.licenseType, locale)}
            </p>
          ) : page.brokerage && !agencyName ? (
            <p>{page.brokerage}</p>
          ) : null}
          {phone ? (
            <p>
              {copy.phone}:{" "}
              <a href={`tel:${phone.replace(/\s+/g, "")}`}>{phone}</a>
            </p>
          ) : null}
          <p>
            <a href={`mailto:${page.agentEmail}`}>{page.agentEmail}</a>
          </p>
        </section>
      ) : null}

      {!preview &&
      branded &&
      customDomainsEnabled() &&
      listingDomain &&
      !listingDomain.paidUntil ? (
        <ListingDomainCta slug={slug} />
      ) : null}

      {!preview && branded && page.leadCapture === 1 ? (
        <ListingLeadForm slug={slug} agentName={page.agentName} />
      ) : null}

      {mapSrc ? (
        <section className="listing-map">
          <iframe title="Map" src={mapSrc} loading="lazy" />
        </section>
      ) : (
        <p className="muted listing-map-fallback">
          <a
            href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(page.propertyAddress)}`}
            target="_blank"
            rel="noreferrer"
          >
            {copy.viewMap}
          </a>
        </p>
      )}

      {branded ? (
        <footer className="delivery-footer">
          <p>{copy.photosBy(tenant.photographerName)}</p>
        </footer>
      ) : null}
    </main>
  );
}
