import { afterEach, describe, expect, it } from "vitest";
import {
  cookieDomain,
  hostnameFromHost,
  isLocalRequestHost,
  isPlatformHostname,
  platformEmailFrom,
  platformSeo,
  platformTheme,
  publicStudioUrl,
  requestPublicOrigin,
  safePortalPath,
  studioOrigin,
} from "@/lib/platform";

describe("public studio URLs", () => {
  const previous = {
    root: process.env.PLATFORM_ROOT_DOMAIN,
    publicUrl: process.env.PLATFORM_PUBLIC_URL,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  };

  afterEach(() => {
    if (previous.root === undefined) delete process.env.PLATFORM_ROOT_DOMAIN;
    else process.env.PLATFORM_ROOT_DOMAIN = previous.root;
    if (previous.publicUrl === undefined) delete process.env.PLATFORM_PUBLIC_URL;
    else process.env.PLATFORM_PUBLIC_URL = previous.publicUrl;
    if (previous.siteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous.siteUrl;
  });

  it("uses https slug host with no port in production", () => {
    process.env.PLATFORM_ROOT_DOMAIN = "studiofront.ca";
    process.env.PLATFORM_PUBLIC_URL = "https://studiofront.ca";
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";

    expect(studioOrigin({ slug: "silentshutter" })).toBe(
      "https://silentshutter.studiofront.ca",
    );
    expect(
      publicStudioUrl({
        slug: "silentshutter",
        siteUrl: "http://silentshutter.localhost:3000",
      }),
    ).toBe("https://silentshutter.studiofront.ca");
  });

  it("prefers custom domain only when active", () => {
    process.env.PLATFORM_ROOT_DOMAIN = "studiofront.ca";
    expect(
      publicStudioUrl({
        slug: "silentshutter",
        domain: "silent.shutter.com",
        domainStatus: "pending",
        siteUrl: "https://silent.shutter.com",
      }),
    ).toBe("https://silentshutter.studiofront.ca");
    expect(
      publicStudioUrl({
        slug: "silentshutter",
        domain: "silent.shutter.com",
        domainStatus: "active",
        siteUrl: "https://silent.shutter.com",
      }),
    ).toBe("https://silent.shutter.com");
  });

  it("prefers custom domain over slug in production when passed to studioOrigin", () => {
    process.env.PLATFORM_ROOT_DOMAIN = "studiofront.ca";
    expect(
      studioOrigin({ slug: "silentshutter", domain: "photos.example.com" }),
    ).toBe("https://photos.example.com");
  });

  it("keeps localhost ports for local platform", () => {
    process.env.PLATFORM_ROOT_DOMAIN = "localhost";
    process.env.PLATFORM_PUBLIC_URL = "http://localhost:3000";
    expect(studioOrigin({ slug: "silentshutter" })).toBe(
      "http://silentshutter.localhost:3000",
    );
    expect(
      publicStudioUrl({
        slug: "silentshutter",
        siteUrl: "https://silentshutter.studiofront.ca",
      }),
    ).toBe("http://silentshutter.localhost:3000");
  });

  it("prefers forwarded host over the workers.dev request URL", () => {
    const request = new Request("https://studiofront.workers.dev/portal/callback", {
      headers: {
        host: "studiofront.workers.dev",
        "x-forwarded-host": "silentshutter.studiofront.ca",
        "x-forwarded-proto": "https",
      },
    });
    expect(requestPublicOrigin(request)).toBe("https://silentshutter.studiofront.ca");
  });

  it("only allows in-app portal next paths", () => {
    expect(safePortalPath("/portal/listings/lp_1")).toBe("/portal/listings/lp_1");
    expect(safePortalPath("//evil.example/portal")).toBeNull();
    expect(safePortalPath("https://evil.example/portal")).toBeNull();
    expect(safePortalPath("/admin")).toBeNull();
    expect(safePortalPath(12)).toBeNull();
    expect(safePortalPath("/portal\\evil")).toBeNull();
  });

  it("derives cookie domain and platform hostnames", () => {
    process.env.PLATFORM_ROOT_DOMAIN = "studiofront.ca";
    expect(hostnameFromHost("silentshutter.studiofront.ca:443")).toBe(
      "silentshutter.studiofront.ca",
    );
    expect(cookieDomain("localhost")).toBeUndefined();
    expect(cookieDomain("silentshutter.localhost")).toBe(".localhost");
    expect(cookieDomain("silentshutter.studiofront.ca")).toBe(".studiofront.ca");
    expect(isPlatformHostname("studiofront.ca")).toBe(true);
    expect(isPlatformHostname("www.studiofront.ca")).toBe(true);
    expect(isPlatformHostname("silentshutter.studiofront.ca")).toBe(false);
    expect(isLocalRequestHost("127.0.0.1")).toBe(true);
    expect(platformSeo().title).toMatch(/Studiofront/);
    expect(platformEmailFrom()).toMatch(/@/);
    expect(platformTheme().accent).toBe("#2f5d50");
  });

  it("falls back to the request origin when no forwarded host is set", () => {
    const request = new Request("https://example.test/book");
    expect(requestPublicOrigin(request)).toBe("https://example.test");
  });
});
