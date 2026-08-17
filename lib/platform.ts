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
 * Local (`PLATFORM_ROOT_DOMAIN=localhost`): http://{slug}.localhost:{port}.
 */
export function studioOrigin(options: {
  slug: string;
  domain?: string | null;
  requestOrigin?: string | null;
}) {
  if (options.domain) {
    const proto = isLocalPlatform() ? "http" : "https";
    return `${proto}://${options.domain.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  }

  const root = platformRootDomain();
  if (!isLocalPlatform()) {
    return `https://${options.slug}.${root}`;
  }

  let port = "";
  const origin = options.requestOrigin ?? platformPublicUrl();
  try {
    port = new URL(origin).port;
  } catch {
    port = "";
  }
  const host = port ? `${options.slug}.${root}:${port}` : `${options.slug}.${root}`;
  return `http://${host}`;
}

/**
 * Resolve the public studio base URL for share links, emails, and galleries.
 * Ignores a stored siteUrl that still points at localhost when the platform is prod.
 * Custom domains are used only when domainStatus is active (HTTPS live).
 */
export function publicStudioUrl(options: {
  slug: string;
  domain?: string | null;
  domainStatus?: string | null;
  siteUrl?: string | null;
  requestOrigin?: string | null;
}) {
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

  if (!isLocalPlatform() && isLocalhostUrl(stored)) {
    return rebuilt;
  }

  if (isLocalPlatform() && !isLocalhostUrl(stored) && !domainLive) {
    // Local dev with a prod-looking stored URL — prefer live local origin.
    return rebuilt;
  }

  // Stored custom-domain URL while domain is not live yet → fall back to slug host.
  if (
    !isLocalPlatform() &&
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
    title: `${name} — White-label software for real estate photographers`,
    description: `${name} gives photographers a branded site, booking, gated galleries, and property pages. $49 / $99 / $179 per month.`,
  };
}
