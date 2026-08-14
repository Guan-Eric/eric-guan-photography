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
    paper: "rgba(252, 253, 250, 0.72)",
    radius: "2px",
    fontDisplay: "var(--font-syne), sans-serif",
    fontBody: "var(--font-figtree), sans-serif",
  };
}

export function hostnameFromHost(host: string | null | undefined) {
  return (host ?? "").split(":")[0].toLowerCase();
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

export function cookieDomain() {
  if (isLocalPlatform()) return undefined;
  return `.${platformRootDomain()}`;
}

export function studioOrigin(options: {
  slug: string;
  domain?: string | null;
  requestOrigin?: string | null;
}) {
  if (options.domain) {
    const proto = platformPublicUrl().startsWith("https") ? "https" : "http";
    return `${proto}://${options.domain}`;
  }

  const root = platformRootDomain();
  let port = "";
  const origin = options.requestOrigin ?? platformPublicUrl();
  try {
    port = new URL(origin).port;
  } catch {
    port = "";
  }
  const host = port ? `${options.slug}.${root}:${port}` : `${options.slug}.${root}`;
  const proto = origin.startsWith("https") ? "https" : "http";
  return `${proto}://${host}`;
}

export function platformSeo() {
  const name = platformName();
  return {
    title: `${name} — White-label software for real estate photographers`,
    description: `${name} gives photographers a branded site, booking, gated galleries, and property pages. $49 / $99 / $179 per month.`,
  };
}
