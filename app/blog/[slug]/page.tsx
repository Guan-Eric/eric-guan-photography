import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogArticle } from "@/components/blog-article";
import { BlogPostingJsonLd } from "@/components/json-ld";
import { getBlogPost, getBlogSlugs, postPath } from "@/lib/blog";
import { platformName, platformPublicUrl } from "@/lib/platform";
import { getRequestTenant } from "@/lib/tenants";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export function generateStaticParams() {
  return getBlogSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) {
    return { title: "Article not found" };
  }

  const url = new URL(postPath(post.slug), platformPublicUrl()).toString();
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: postPath(post.slug) },
    openGraph: {
      type: "article",
      siteName: platformName(),
      title: post.title,
      description: post.description,
      url,
      publishedTime: post.date,
      modifiedTime: post.updated ?? post.date,
      tags: post.tags,
      images: [{ url: "/opengraph-image" }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: ["/opengraph-image"],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const tenant = await getRequestTenant();
  if (tenant) notFound();

  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const url = new URL(postPath(post.slug), platformPublicUrl()).toString();

  return (
    <>
      <BlogPostingJsonLd
        post={post}
        url={url}
        siteName={platformName()}
      />
      <BlogArticle post={post} />
    </>
  );
}
