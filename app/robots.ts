import type { MetadataRoute } from "next";
import { platformPublicUrl } from "@/lib/platform";
import { ROBOTS_DISALLOW_PATHS } from "@/lib/seo-crawl";
import { getRequestTenant } from "@/lib/tenants";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const tenant = await getRequestTenant();
  const sitemap = new URL(
    "/sitemap.xml",
    tenant?.siteUrl ?? platformPublicUrl(),
  ).toString();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...ROBOTS_DISALLOW_PATHS],
      },
    ],
    sitemap,
  };
}
