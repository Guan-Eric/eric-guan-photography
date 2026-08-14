import { platformTheme, studioOrigin } from "@/lib/platform";
import type { Tenant } from "@/lib/tenant-schema";

const PLACEHOLDER_HERO = {
  src: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=2400&q=80",
  alt: "Bright modern home exterior",
  width: 2400,
  height: 1600,
};

export function buildStudioConfig(options: {
  id: string;
  slug: string;
  studioName: string;
  photographerName: string;
  email: string;
  accent?: string;
}): Tenant {
  const accent = options.accent ?? "#2f5d50";
  const siteUrl = studioOrigin({ slug: options.slug });

  return {
    id: options.id,
    slug: options.slug,
    domain: null,
    studioName: options.studioName,
    photographerName: options.photographerName,
    tagline: "Property photos that help listings move.",
    lede:
      "Clean, bright real estate photography for agents — shot fast, edited clean, delivered ready for MLS and marketing.",
    email: options.email,
    phone: null,
    instagram: null,
    siteUrl,
    theme: {
      ...platformTheme(),
      accent,
      accentSoft: accent,
    },
    nav: [
      { label: "Work", href: "/#work" },
      { label: "Pricing", href: "/pricing" },
      { label: "Book", href: "/book" },
    ],
    hero: PLACEHOLDER_HERO,
    gallery: [],
    packages: [
      {
        id: "standard",
        name: "Standard listing",
        summary: "15–25 edited photos · interiors + exterior · 24–48h delivery",
        price: "$150–$250",
        durationMinutes: 60,
        includes: [
          "15–25 fully edited images",
          "Interiors and exterior",
          "MLS-sized and full-resolution downloads",
          "24–48 hour delivery",
        ],
      },
      {
        id: "premium",
        name: "Premium listing",
        summary: "25–40 photos · detail frames · priority edit",
        price: "$250–$350",
        durationMinutes: 90,
        includes: [
          "25–40 fully edited images",
          "Detail frames",
          "Priority edit queue",
          "Single-property website",
        ],
        featured: true,
      },
      {
        id: "floor-plan",
        name: "Floor plan",
        summary: "Add a 2D floor plan to the gallery",
        price: "$75",
        durationMinutes: null,
        includes: ["Simple 2D floor plan overlay"],
        upsell: true,
        priceCents: 7500,
      },
      {
        id: "twilight",
        name: "Twilight exterior",
        summary: "Dusk exterior set after the main shoot",
        price: "$125",
        durationMinutes: null,
        includes: ["3–5 twilight exteriors"],
        upsell: true,
        priceCents: 12500,
      },
    ],
    process: [
      {
        title: "Book",
        body: "Get an instant quote, pick an open slot, and send access notes online.",
      },
      {
        title: "Shoot",
        body: "On-site session focused on flow, light, and buyer-first framing.",
      },
      {
        title: "Deliver",
        body: "Color-corrected gallery ready for MLS, social, and flyers.",
      },
    ],
    serviceAreas: [
      {
        city: "Your market",
        slug: "service-area",
        neighbourhoods: [],
      },
    ],
    serviceAreaGate: {
      enabled: false,
      region: "none",
      prefixes: [],
      message: "This studio does not currently cover that area.",
    },
    turnaround: "24–48 hours",
    seo: {
      description: `${options.studioName} — real estate photography for agents. MLS-ready galleries delivered in 24–48 hours.`,
      currency: "USD",
      priceRange: "$$",
    },
    portfolioComplete: false,
  };
}
