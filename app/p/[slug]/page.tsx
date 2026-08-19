import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingLeadForm } from "@/components/listing-lead-form";
import { ListingDomainCta } from "@/components/listing-domain-cta";
import { MediaEmbeds } from "@/components/media-embeds";
import { customDomainsEnabled } from "@/lib/custom-domain";
import { TIME_ZONE } from "@/lib/availability";
import {
  formatOpenHouse,
  parseOpenHouses,
  parseSections,
} from "@/lib/listing-content";
import { listingPageForPublic } from "@/lib/listing-pages";
import { getListingDomainForPage } from "@/lib/domain-billing";
import { listingTheme, listingThemeStyle } from "@/lib/listing-themes";
import { requireRequestTenant } from "@/lib/tenants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { slug: string };
type Search = { brand?: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const tenant = await requireRequestTenant();
  const { slug } = await params;
  const data = await listingPageForPublic(tenant.id, slug);
  if (!data) return { title: "Listing", robots: { index: false, follow: false } };
  return {
    title: data.page.title,
    description:
      data.page.description?.slice(0, 160) ?? `Photos of ${data.page.propertyAddress}`,
    robots: { index: false, follow: false },
  };
}

export default async function ListingPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const tenant = await requireRequestTenant();
  const { slug } = await params;
  const query = await searchParams;
  const data = await listingPageForPublic(tenant.id, slug);
  if (!data) notFound();

  const branded = query.brand !== "off" && data.page.brandMode !== "unbranded";
  const { page, media, links } = data;
  const listingDomain = await getListingDomainForPage(tenant.id, page.id);
  const theme = listingTheme(page.theme);
  const sections = parseSections(page.sectionsJson);
  const openHouses = parseOpenHouses(page.openHouseJson);
  const hero = page.heroAssetId
    ? (media.find((asset) => asset.id === page.heroAssetId) ?? media[0])
    : media[0];
  const rest = hero ? media.filter((asset) => asset.id !== hero.id) : media;

  const embeds = links.map((link) => ({
    id: link.id,
    kind: link.kind,
    provider: link.provider,
    url: link.url,
    title: link.title,
    docHref: link.storagePath ? `/api/p/${slug}/doc/${link.id}` : null,
  }));

  const mapSrc =
    page.mapLat && page.mapLng
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${Number(page.mapLng) - 0.01}%2C${Number(page.mapLat) - 0.01}%2C${Number(page.mapLng) + 0.01}%2C${Number(page.mapLat) + 0.01}&layer=mapnik&marker=${page.mapLat}%2C${page.mapLng}`
      : null;

  return (
    <main
      className={`listing-page listing-page--${theme}`}
      id="main"
      style={listingThemeStyle(theme)}
    >
      <header className="listing-hero">
        {hero ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            className="listing-hero-image"
            src={`/api/p/${slug}/media/${hero.id}`}
            alt={hero.roomLabel || page.propertyAddress}
            width={hero.width}
            height={hero.height}
          />
        ) : null}
        <div className="listing-hero-copy">
          {branded ? <p className="eyebrow">{tenant.studioName}</p> : null}
          <h1>{page.headline ?? page.title}</h1>
          <p className="lede">{page.propertyAddress}</p>
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
                src={`/api/p/${slug}/media/${asset.id}`}
                alt={asset.roomLabel || page.propertyAddress}
                width={asset.width}
                height={asset.height}
                loading="lazy"
              />
              {asset.roomLabel ? (
                <figcaption>{asset.roomLabel}</figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      ) : media.length === 0 ? (
        <div className="listing-empty">
          <p>Photos for this listing are still being prepared.</p>
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
          <h2>Open house</h2>
          <ul className="listing-open-houses">
            {openHouses.map((entry, index) => (
              <li key={index}>{formatOpenHouse(entry, TIME_ZONE)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {branded ? (
        <section className="listing-agent">
          <p className="eyebrow">Presented by</p>
          <h2>{page.agentName}</h2>
          {page.brokerage ? <p>{page.brokerage}</p> : null}
          <p>
            <a href={`mailto:${page.agentEmail}`}>{page.agentEmail}</a>
          </p>
        </section>
      ) : null}

      {branded && customDomainsEnabled() && listingDomain && !listingDomain.paidUntil ? (
        <ListingDomainCta slug={slug} />
      ) : null}

      {branded && page.leadCapture === 1 ? (
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
            View on OpenStreetMap
          </a>
        </p>
      )}

      {branded ? (
        <footer className="delivery-footer">
          <p>Photos by {tenant.photographerName}.</p>
        </footer>
      ) : null}
    </main>
  );
}
