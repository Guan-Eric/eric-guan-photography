import type { MetadataRoute } from "next";
import { platformPublicUrl } from "@/lib/platform";
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
        disallow: ["/g/", "/p/", "/api/", "/admin", "/admin/", "/book/confirmation/", "/invite/"],
      },
    ],
    sitemap,
  };
}
