import type { MetadataRoute } from "next";
import { platformPublicUrl } from "@/lib/platform";
import { getRequestTenant } from "@/lib/tenants";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tenant = await getRequestTenant();
  const lastModified = new Date();

  if (!tenant) {
    const base = platformPublicUrl();
    return ["/", "/pricing", "/signup", "/login", "/terms", "/privacy"].map((path) => ({
      url: new URL(path, base).toString(),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: path === "/" ? 1 : 0.7,
    }));
  }

  const staticRoutes = [
    { path: "/", priority: 1 },
    { path: "/book", priority: 0.95 },
    { path: "/pricing", priority: 0.8 },
    { path: "/prep", priority: 0.5 },
  ];

  const cityRoutes = tenant.serviceAreas.map((area) => ({
    path: `/real-estate-photography/${area.slug}`,
    priority: 0.9,
  }));

  return [...staticRoutes, ...cityRoutes].map((route) => ({
    url: new URL(route.path, tenant.siteUrl).toString(),
    lastModified,
    changeFrequency: "monthly" as const,
    priority: route.priority,
  }));
}
