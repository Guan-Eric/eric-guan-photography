import { afterEach, describe, expect, it } from "vitest";
import { publicStudioUrl, studioOrigin } from "@/lib/platform";

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
});
