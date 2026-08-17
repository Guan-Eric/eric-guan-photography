import type { CSSProperties } from "react";
import type { ThemeTokens } from "@/lib/tenant-schema";

/**
 * Listing-page looks an agent can pick. Pure data plus a CSS-variable mapper,
 * so both the editor preview and the public page can import this.
 */
export const LISTING_THEMES = ["gallery", "editorial", "coastal"] as const;
export type ListingTheme = (typeof LISTING_THEMES)[number];

export type ListingThemeDef = {
  label: string;
  blurb: string;
  tokens: ThemeTokens;
};

const GALLERY: ThemeTokens = {
  bg: "#f7f6f3",
  bgDeep: "#e7e5df",
  ink: "#191a17",
  inkSoft: "#5d5f58",
  line: "rgba(25, 26, 23, 0.14)",
  accent: "#3f6f4f",
  accentSoft: "#8fae96",
  paper: "rgba(255, 255, 255, 0.86)",
  radius: "2px",
  fontDisplay: "var(--font-syne), system-ui",
  fontBody: "var(--font-figtree), system-ui",
};

const EDITORIAL: ThemeTokens = {
  bg: "#1d1b19",
  bgDeep: "#100f0e",
  ink: "#f4f1ec",
  inkSoft: "#b3aca3",
  line: "rgba(244, 241, 236, 0.18)",
  accent: "#c8a45c",
  accentSoft: "#8a7440",
  paper: "rgba(244, 241, 236, 0.07)",
  radius: "0px",
  fontDisplay: "var(--font-syne), Georgia, serif",
  fontBody: "var(--font-figtree), system-ui",
};

const COASTAL: ThemeTokens = {
  bg: "#f2f7f8",
  bgDeep: "#dbe9ec",
  ink: "#14282e",
  inkSoft: "#4e6a72",
  line: "rgba(20, 40, 46, 0.16)",
  accent: "#1f6f86",
  accentSoft: "#7fb2c1",
  paper: "rgba(255, 255, 255, 0.9)",
  radius: "10px",
  fontDisplay: "var(--font-syne), system-ui",
  fontBody: "var(--font-figtree), system-ui",
};

export const LISTING_THEME_DEFS: Record<ListingTheme, ListingThemeDef> = {
  gallery: {
    label: "Gallery",
    blurb: "Warm off-white, square corners, photography first.",
    tokens: GALLERY,
  },
  editorial: {
    label: "Editorial",
    blurb: "Deep ink with brass accents for high-end listings.",
    tokens: EDITORIAL,
  },
  coastal: {
    label: "Coastal",
    blurb: "Cool light blues and soft corners for waterfront homes.",
    tokens: COASTAL,
  },
};

export function isListingTheme(value: unknown): value is ListingTheme {
  return typeof value === "string" && (LISTING_THEMES as readonly string[]).includes(value);
}

export function listingTheme(value: unknown): ListingTheme {
  return isListingTheme(value) ? value : "gallery";
}

/** CSS custom properties for a listing theme, applied on the page wrapper. */
export function listingThemeStyle(theme: ListingTheme): CSSProperties {
  const tokens = LISTING_THEME_DEFS[theme].tokens;
  return {
    "--bg": tokens.bg,
    "--bg-deep": tokens.bgDeep,
    "--ink": tokens.ink,
    "--ink-soft": tokens.inkSoft,
    "--line": tokens.line,
    "--accent": tokens.accent,
    "--accent-soft": tokens.accentSoft,
    "--paper": tokens.paper,
    "--radius": tokens.radius,
    "--font-display": tokens.fontDisplay,
    "--font-body": tokens.fontBody,
    background: `linear-gradient(180deg, ${tokens.bg} 0%, ${tokens.bgDeep} 100%)`,
    color: tokens.ink,
  } as CSSProperties;
}
