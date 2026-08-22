import { describe, expect, it } from "vitest";
import {
  PLATFORM_SITEMAP_PATHS,
  ROBOTS_DISALLOW_PATHS,
} from "@/lib/seo-crawl";

describe("seo crawl lists", () => {
  it("keeps platform sitemap free of noindex auth routes", () => {
    expect(PLATFORM_SITEMAP_PATHS).toContain("/");
    expect(PLATFORM_SITEMAP_PATHS).toContain("/blog");
    expect(PLATFORM_SITEMAP_PATHS).toContain("/pricing");
    expect(PLATFORM_SITEMAP_PATHS).not.toContain("/login");
    expect(PLATFORM_SITEMAP_PATHS).not.toContain("/signup");
    expect(PLATFORM_SITEMAP_PATHS).not.toContain("/work");
  });

  it("disallows private, auth, and admin surfaces in robots", () => {
    for (const path of [
      "/g/",
      "/p/",
      "/api/",
      "/admin/",
      "/portal/",
      "/onboarding/",
      "/appsumo/",
      "/review/",
      "/login",
      "/signup",
      "/forgot-password",
      "/reset-password",
      "/work",
    ]) {
      expect(ROBOTS_DISALLOW_PATHS).toContain(path);
    }
  });

  it("does not disallow public marketing paths", () => {
    for (const path of PLATFORM_SITEMAP_PATHS) {
      if (path === "/") continue;
      expect(ROBOTS_DISALLOW_PATHS).not.toContain(path);
    }
  });
});
