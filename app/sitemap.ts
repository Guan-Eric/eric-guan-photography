import type { MetadataRoute } from "next";
import { getTenant } from "@/lib/tenants";

export default function sitemap(): MetadataRoute.Sitemap {
  const tenant = getTenant();
  const lastModified = new Date();

  const staticRoutes = [
    { path: "/", priority: 1 },
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
