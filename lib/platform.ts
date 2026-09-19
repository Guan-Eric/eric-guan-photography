import type { ThemeTokens } from "@/lib/tenant-schema";

export const PLATFORM_HOST_HEADER = "x-platform-host";
export const TENANT_HOST_HEADER = "x-tenant-host";

export function platformName() {
  return process.env.PLATFORM_NAME ?? "Studiofront";
}

export function platformRootDomain() {
  return (process.env.PLATFORM_ROOT_DOMAIN ?? "localhost").toLowerCase();
}

export function platformPublicUrl() {
  return (
    process.env.PLATFORM_PUBLIC_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"
  );
}

export function platformEmailFrom() {
  return (
    process.env.PLATFORM_EMAIL_FROM ??
    process.env.EMAIL_FROM ??
    `${platformName()} <onboarding@resend.dev>`
  );
}

export function platformTheme(): ThemeTokens {
  return {
    bg: "#e8ebe6",
    bgDeep: "#dfe4dd",
    ink: "#171a17",
    inkSoft: "#4a524c",
    line: "rgba(23, 26, 23, 0.12)",
    accent: "#2f5d50",
    accentSoft: "#3f7a69",
    paper: "#ffffff",
    radius: "2px",
    fontDisplay: "var(--font-syne), sans-serif",
    fontBody: "var(--font-figtree), sans-serif",
  };
}

export function hostnameFromHost(host: string | null | undefined) {
  return (host ?? "").split(":")[0].toLowerCase();
}

/**
 * Allow only same-origin portal paths after OTP (or legacy magic-link) sign-in.
 */
export function safePortalPath(value: unknown) {
  if (typeof value !== "string") return null;
  const path = value.trim();
  if (!path.startsWith("/portal")) return null;
  if (path.startsWith("//") || path.includes("://") || path.includes("\\")) {
    return null;
  }
  return path;
}

/**
 * Public origin for redirects. Prefer forwarded Host over `request.url`,
 * which on Cloudflare Workers can be the `*.workers.dev` URL.
 */
export function requestPublicOrigin(request: Request) {
  const url = new URL(request.url);
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.split(",")[0]?.trim();
  if (!host) return url.origin;
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (url.protocol === "https:" ? "https" : "http");
  return `${proto}://${host}`;
}

export function isPlatformHostname(hostname: string) {
  const host = hostname.split(":")[0].toLowerCase();
  const root = platformRootDomain();
  return (
    !host ||
    host === root ||
    host === `www.${root}` ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]"
  );
}

export function isLocalPlatform() {
  const root = platformRootDomain();
  return root === "localhost" || root === "127.0.0.1";
}

/** `next dev` should keep share/gallery links on localhost even if env points at prod. */
export function preferLocalStudioUrls() {
  return process.env.NODE_ENV === "development" || isLocalPlatform();
}

function isLocalhostUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const host = new URL(value).hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".localhost")
    );
  } catch {
    return /localhost|127\.0\.0\.1/i.test(value);
  }
}

function localDevPort(requestOrigin?: string | null) {
  const candidates = [
    requestOrigin,
    process.env.PORT ? `http://localhost:${process.env.PORT}` : null,
    "http://localhost:3000",
  ];
  for (const candidate of candidates) {
    if (!candidate || !isLocalhostUrl(candidate)) continue;
    try {
      const port = new URL(candidate).port;
      return port || "3000";
    } catch {
      /* try next */
    }
  }
  return "3000";
}

function localDevStudioOrigin(slug: string, requestOrigin?: string | null) {
  const port = localDevPort(requestOrigin);
  return `http://${slug}.localhost:${port}`;
}

export function cookieDomain(hostname?: string | null) {
  const host = hostnameFromHost(hostname);
  const root = platformRootDomain();

  // Prefer the *request* host, not only PLATFORM_ROOT_DOMAIN. Local `next dev`
  // on localhost must not emit Domain=.studiofront.ca when env is production-like.
  if (!host || host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
    return undefined;
  }
  if (host.endsWith(".localhost")) {
    return ".localhost";
  }
  if (host === root || host.endsWith(`.${root}`) || host === `www.${root}`) {
    return `.${root}`;
  }
  return undefined;
}

/** True when the current request host is a local browser host. */
export function isLocalRequestHost(hostname?: string | null) {
  const host = hostnameFromHost(hostname);
  return (
    !host ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host.endsWith(".localhost")
  );
}

/**
 * Canonical public origin for a studio.
 * Production: always https, never a port.
 * Local (`PLATFORM_ROOT_DOMAIN=localhost` or `next dev`): http://{slug}.localhost:{port}.
 */
export function studioOrigin(options: {
  slug: string;
  domain?: string | null;
  requestOrigin?: string | null;
}) {
  if (preferLocalStudioUrls()) {
    // Custom domains / prod env values don't resolve in next dev.
    return localDevStudioOrigin(options.slug, options.requestOrigin);
  }

  if (options.domain) {
    return `https://${options.domain.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  }

  const root = platformRootDomain();
  return `https://${options.slug}.${root}`;
}

/**
 * Resolve the public studio base URL for share links, emails, and galleries.
 * Ignores a stored siteUrl that still points at localhost when the platform is prod.
 * In `next dev`, always returns a localhost slug URL so admin "Open gallery" stays local.
 * Custom domains are used only when domainStatus is active (HTTPS live) outside development.
 */
export function publicStudioUrl(options: {
  slug: string;
  domain?: string | null;
  domainStatus?: string | null;
  siteUrl?: string | null;
  requestOrigin?: string | null;
}) {
  if (preferLocalStudioUrls()) {
    return localDevStudioOrigin(options.slug, options.requestOrigin);
  }

  const domainLive =
    Boolean(options.domain) &&
    (options.domainStatus === "active" || options.domainStatus === "verified");

  const rebuilt = studioOrigin({
    slug: options.slug,
    domain: domainLive ? options.domain : null,
    requestOrigin: options.requestOrigin,
  });

  const stored = options.siteUrl?.trim();
  if (!stored) return rebuilt;

  if (isLocalhostUrl(stored)) {
    return rebuilt;
  }

  // Stored custom-domain URL while domain is not live yet → fall back to slug host.
  if (
    !domainLive &&
    options.domain &&
    stored.includes(options.domain)
  ) {
    return rebuilt;
  }

  return stored.replace(/\/$/, "");
}

export function platformSeo() {
  const name = platformName();
  return {
    title: `${name} — Book the shoot. Deliver the gallery. Get paid.`,
    description: `${name} gives real estate photographers a branded site, booking, and gated galleries — on your brand. Agents open a link. They never create an account.`,
    image:
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&h=630&q=80",
    imageAlt: "Bright modern home ready for listing photographs",
  };
}
