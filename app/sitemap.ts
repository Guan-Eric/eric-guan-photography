import type { MetadataRoute } from "next";
import { blogPosts, postPath } from "@/lib/blog";
import { platformPublicUrl } from "@/lib/platform";
import { getRequestTenant } from "@/lib/tenants";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tenant = await getRequestTenant();
  const lastModified = new Date();

  if (!tenant) {
    const base = platformPublicUrl();
    const marketing = [
      "/",
      "/pricing",
      "/blog",
      "/signup",
      "/login",
      "/terms",
      "/privacy",
    ].map((path) => ({
      url: new URL(path, base).toString(),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: path === "/" ? 1 : path === "/blog" ? 0.8 : 0.7,
    }));
    const posts = blogPosts.map((post) => ({
      url: new URL(postPath(post.slug), base).toString(),
      lastModified: new Date(post.updated ?? post.date),
      changeFrequency: "monthly" as const,
      priority: 0.75,
    }));
    return [...marketing, ...posts];
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
