import type { MetadataRoute } from "next";
import { getTenant } from "@/lib/tenants";

export default function robots(): MetadataRoute.Robots {
  const tenant = getTenant();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Client galleries are private by design and must never be indexed,
        // even though they are reachable by signed link.
        disallow: ["/g/", "/api/"],
      },
    ],
    sitemap: new URL("/sitemap.xml", tenant.siteUrl).toString(),
  };
}
