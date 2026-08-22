/**
 * Shared crawl lists for sitemap + robots.
 * Keep indexable marketing URLs and private/auth paths in one place.
 */

/** Platform marketing URLs that should appear in the apex sitemap. */
export const PLATFORM_SITEMAP_PATHS = [
  "/",
  "/pricing",
  "/lifetime",
  "/blog",
  "/terms",
  "/privacy",
] as const;

/**
 * Paths bots should skip. Private galleries, admin, auth, and other
 * noindex surfaces — do not advertise these in the sitemap either.
 */
export const ROBOTS_DISALLOW_PATHS = [
  "/g/",
  "/p/",
  "/api/",
  "/admin",
  "/admin/",
  "/book/confirmation/",
  "/invite/",
  "/portal/",
  "/onboarding",
  "/onboarding/",
  "/appsumo/",
  "/review/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/work",
] as const;
