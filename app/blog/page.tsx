import type { Metadata } from "next";
import { BlogIndex } from "@/components/blog-index";
import { notFound } from "next/navigation";
import { getRequestTenant } from "@/lib/tenants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Guides for real estate photographers: Aryeo alternatives, delivery without agent login, pricing, and migration playbooks.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Blog",
    description:
      "Guides for real estate photographers: Aryeo alternatives, delivery without agent login, pricing, and migration playbooks.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog",
    description:
      "Guides for real estate photographers: Aryeo alternatives, delivery without agent login, pricing, and migration playbooks.",
  },
};

export default async function BlogIndexPage() {
  const tenant = await getRequestTenant();
  if (tenant) notFound();
  return <BlogIndex />;
}
