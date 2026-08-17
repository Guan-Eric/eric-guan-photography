/**
 * Shape of a photographer's public-facing site.
 *
 * Every tenant site in the product is rendered from one of these. Today the
 * records live in `content/tenants/`; when the platform gets a database this
 * becomes the row shape, and only the loader in `lib/tenants.ts` changes.
 *
 * Anything a photographer could reasonably want to differ between studios
 * belongs here. Anything structural (layout, section order, markup) does not.
 */

export type ThemeTokens = {
  /** Page background, light end of the gradient. */
  bg: string;
  /** Page background, deep end of the gradient. */
  bgDeep: string;
  /** Primary text colour. */
  ink: string;
  /** Secondary text colour. */
  inkSoft: string;
  /** Hairline borders and dividers. */
  line: string;
  /** Brand accent, used for eyebrows and prices. */
  accent: string;
  /** Lighter accent, used for step numbers. */
  accentSoft: string;
  /** Translucent panel fill. */
  paper: string;
  /** Corner radius applied to cards, images, and buttons. */
  radius: string;
  /** Display/heading typeface stack. */
  fontDisplay: string;
  /** Body typeface stack. */
  fontBody: string;
};

export type NavLink = {
  label: string;
  href: string;
};

export type ImageAsset = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

export type GalleryImage = ImageAsset & {
  /** Caption shown under the image, e.g. "Kitchen". */
  room: string;
  /** Supporting caption, e.g. "Detail & flow". */
  note: string;
  /**
   * Wide images span the full grid width and render 16:9 instead of 4:5.
   * Use for exteriors and open living spaces.
   */
  wide?: boolean;
};

export type PriceBand = {
  maxSqft: number;
  priceCents: number;
  label: string;
};

export type Package = {
  id: string;
  name: string;
  summary: string;
  /** Display string rather than a number — ranges and "Custom" are both valid. */
  price: string;
  /**
   * Used by the booking engine to block the calendar realistically.
   * Null for packages that aren't directly bookable, like a retainer.
   */
  durationMinutes: number | null;
  /** Bullets shown on the pricing page. */
  includes: string[];
  featured?: boolean;
  /** When set, this package can be offered as an in-gallery upsell. */
  upsell?: boolean;
  /** Firm add-on / flat booking price in cents. */
  priceCents?: number;
  /** Square-footage quote bands. When absent, `priceCents` is used as a single band. */
  priceBands?: PriceBand[];
  /**
   * Agents can request the shoot online; you confirm the price after reviewing
   * the property details. Requires `durationMinutes` for scheduling.
   */
  quoteLater?: boolean;
};

export type ProcessStep = {
  title: string;
  body: string;
};

export type ServiceArea = {
  /** City or region name as an agent would say it. */
  city: string;
  /** URL segment for the local landing page. */
  slug: string;
  /** Neighbourhoods and nearby towns, used as supporting SEO copy. */
  neighbourhoods: string[];
};

/**
 * Booking geo-gate. When disabled, any postal/ZIP-like value is accepted.
 * Prefixes are Canadian FSAs (H, J4) or US ZIP prefixes (100, 902).
 */
export type ServiceAreaGate = {
  enabled: boolean;
  region: "CA" | "US" | "none";
  prefixes: string[];
  message: string;
};

export const WEEKDAY_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

/** Open/close are wall-clock HH:mm in the studio timezone. Close is the latest finish. */
export type DaySchedule = {
  enabled: boolean;
  open: string;
  close: string;
};

export type WeeklySchedule = {
  days: Record<WeekdayKey, DaySchedule>;
  /** Minutes between offered start times. */
  slotIntervalMinutes: number;
  /** Minimum hours ahead of now before a start is offered. */
  leadTimeHours: number;
  /** How many days ahead to offer on the booking form. */
  offerDays: number;
};

export type Tenant = {
  /** Stable internal id. Becomes the primary key. */
  id: string;
  /** Subdomain segment, e.g. `ericguan` in ericguan.<platform>.com. */
  slug: string;
  /** Custom domain once the tenant connects one. */
  domain: string | null;

  studioName: string;
  /** Person's name, shown in the hero. May match studioName. */
  photographerName: string;
  tagline: string;
  lede: string;

  email: string;
  phone: string | null;
  instagram: string | null;

  /** Absolute base URL, used for canonicals, sitemap, and OG tags. */
  siteUrl: string;

  theme: ThemeTokens;
  nav: NavLink[];
  hero: ImageAsset;
  gallery: GalleryImage[];
  packages: Package[];
  process: ProcessStep[];
  serviceAreas: ServiceArea[];
  serviceAreaGate?: ServiceAreaGate;
  /** When absent, booking uses Mon–Sat 09:00–18:00 defaults. */
  schedule?: WeeklySchedule;

  /** Turnaround promise, e.g. "24–48 hours". Reused across copy and email. */
  turnaround: string;

  seo: {
    /** Falls back to a generated string when absent. */
    title?: string;
    description: string;
    /** Currency code for JSON-LD price ranges. */
    currency: string;
    /** Rough price band for LocalBusiness markup, e.g. "$$". */
    priceRange: string;
  };

  /**
   * True once the tenant has replaced every stock photo with their own work.
   * Gates the "placeholder imagery" notice, and later gates going live.
   */
  portfolioComplete: boolean;
};
