import type { Tenant } from "@/lib/tenant-schema";
import type { Testimonial } from "@/lib/db/schema";

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Content is built from tenant config, not user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * LocalBusiness markup. This is what gets a solo photographer into the local
 * pack for "real estate photographer near me", which is where agents look.
 */
export function LocalBusinessJsonLd({
  tenant,
  testimonials = [],
}: {
  tenant: Tenant;
  testimonials?: Testimonial[];
}) {
  const areaServed = tenant.serviceAreas.map((area) => ({
    "@type": "City",
    name: area.city,
  }));

  const review =
    testimonials.length > 0
      ? testimonials.map((item) => ({
          "@type": "Review",
          author: { "@type": "Person", name: item.agentName },
          reviewBody: item.body,
          reviewRating: {
            "@type": "Rating",
            ratingValue: item.rating,
            bestRating: 5,
          },
        }))
      : undefined;

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "ProfessionalService",
        "@id": `${tenant.siteUrl}#business`,
        name: tenant.studioName,
        description: tenant.seo.description,
        url: tenant.siteUrl,
        email: tenant.email,
        ...(tenant.phone ? { telephone: tenant.phone } : {}),
        image: tenant.hero.src,
        priceRange: tenant.seo.priceRange,
        areaServed,
        founder: { "@type": "Person", name: tenant.photographerName },
        knowsAbout: [
          "Real estate photography",
          "Architectural photography",
          "MLS listing photos",
        ],
        ...(review ? { review, aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: (
            testimonials.reduce((sum, item) => sum + item.rating, 0) /
            testimonials.length
          ).toFixed(1),
          reviewCount: testimonials.length,
        } } : {}),
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: "Real estate photography packages",
          itemListElement: tenant.packages.map((pkg) => ({
            "@type": "Offer",
            name: pkg.name,
            description: pkg.summary,
            priceCurrency: tenant.seo.currency,
            itemOffered: {
              "@type": "Service",
              name: pkg.name,
              serviceType: "Real estate photography",
            },
          })),
        },
      }}
    />
  );
}

export function FaqJsonLd({
  items,
}: {
  items: { question: string; answer: string }[];
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: items.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      }}
    />
  );
}
