import { PREMIUM_LISTING_BANDS, STANDARD_LISTING_BANDS } from "@/lib/quoting";
import type { Tenant } from "@/lib/tenant-schema";

export const ericGuan: Tenant = {
  id: "eric-guan",
  slug: "ericguan",
  domain: null,

  studioName: "Eric Guan",
  photographerName: "Eric Guan",
  tagline: "Property photos that help listings move.",
  lede:
    "Clean, bright real estate photography for agents — shot fast, edited clean, delivered ready for MLS and marketing.",

  email: "ericguan.photo@gmail.com",
  phone: null,
  instagram: null,

  siteUrl: "https://ericguan.photo",

  theme: {
    bg: "#e8ebe6",
    bgDeep: "#dfe4dd",
    ink: "#171a17",
    inkSoft: "#4a524c",
    line: "rgba(23, 26, 23, 0.12)",
    accent: "#2f5d50",
    accentSoft: "#3f7a69",
    paper: "rgba(252, 253, 250, 0.72)",
    radius: "2px",
    fontDisplay: "var(--font-syne), sans-serif",
    fontBody: "var(--font-figtree), sans-serif",
  },

    nav: [
      { label: "Work", href: "/#work" },
      { label: "Pricing", href: "/pricing" },
      { label: "Prep", href: "/prep" },
      { label: "Book", href: "/book" },
    ],

  hero: {
    src: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=2400&q=80",
    alt: "Bright modern home exterior at dusk",
    width: 2400,
    height: 1600,
  },

  gallery: [
    {
      src: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1800&q=80",
      alt: "Living room with large windows and natural light",
      width: 1800,
      height: 1200,
      room: "Living room",
      note: "Natural light · Wide framing",
      wide: true,
    },
    {
      src: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
      alt: "Modern kitchen with island",
      width: 1200,
      height: 1500,
      room: "Kitchen",
      note: "Detail & flow",
    },
    {
      src: "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&q=80",
      alt: "Primary bedroom with soft daylight",
      width: 1200,
      height: 1500,
      room: "Primary bedroom",
      note: "Soft daylight",
    },
    {
      src: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1800&q=80",
      alt: "Home exterior with landscaping",
      width: 1800,
      height: 1100,
      room: "Exterior",
      note: "Curb appeal",
      wide: true,
    },
    {
      src: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80",
      alt: "Bathroom with clean finishes",
      width: 1200,
      height: 1500,
      room: "Bath",
      note: "Clean finishes",
    },
    {
      src: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80",
      alt: "Dining area opening to outdoor light",
      width: 1200,
      height: 1500,
      room: "Dining",
      note: "Indoor–outdoor",
    },
  ],

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
        "Window-pull on bright rooms",
        "MLS-sized and full-resolution downloads",
        "Straightened verticals on every frame",
        "24–48 hour delivery",
      ],
      priceCents: 20000,
      priceBands: STANDARD_LISTING_BANDS,
    },
    {
      id: "premium",
      name: "Premium listing",
      summary: "25–40 photos · detail frames · priority edit",
      price: "$250–$350",
      durationMinutes: 90,
      includes: [
        "25–40 fully edited images",
        "Detail and lifestyle frames",
        "Priority edit queue",
        "Single-property website",
        "Social crops for feed and stories",
      ],
      featured: true,
      priceCents: 30000,
      priceBands: PREMIUM_LISTING_BANDS,
    },
    {
      id: "retainer",
      name: "Agent retainer",
      summary: "Ongoing listings · consistent look · preferred booking window",
      price: "Custom",
      durationMinutes: null,
      includes: [
        "Reserved weekly booking window",
        "Consistent edit profile across every listing",
        "Net-7 billing instead of pay-before-download",
        "Volume pricing per listing",
      ],
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
      city: "Montréal",
      slug: "montreal",
      neighbourhoods: [
        "Plateau-Mont-Royal",
        "Griffintown",
        "Outremont",
        "Westmount",
        "Verdun",
        "Rosemont",
        "Notre-Dame-de-Grâce",
        "Laval",
        "Longueuil",
        "Brossard",
      ],
    },
  ],

  serviceAreaGate: {
    enabled: true,
    region: "CA",
    prefixes: ["H", "J3", "J4", "J5", "J7"],
    message:
      "I currently cover Greater Montréal (island, Laval, South Shore, and nearby North Shore). If this listing is farther out, email me and I’ll say whether the drive works.",
  },

  turnaround: "24–48 hours",

  seo: {
    description:
      "Real estate photography for agents in Montréal. Clean interiors, bright exteriors, MLS-ready galleries delivered in 24–48 hours.",
    currency: "CAD",
    priceRange: "$$",
  },

  portfolioComplete: true,
};
