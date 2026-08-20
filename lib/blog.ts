import {
  blogPosts,
  getBlogPost,
  getBlogSlugs,
  postPath,
  type BlogPost,
} from "@/content/blog";
import { markdownToHtml } from "@/lib/blog-markdown";

export { blogPosts, getBlogPost, getBlogSlugs, postPath, markdownToHtml };
export type { BlogPost };

export function formatBlogDate(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function relatedPosts(post: BlogPost, limit = 3) {
  const tagSet = new Set(post.tags);
  return blogPosts
    .filter((candidate) => candidate.slug !== post.slug)
    .map((candidate) => ({
      post: candidate,
      score: candidate.tags.reduce(
        (sum, tag) => sum + (tagSet.has(tag) ? 1 : 0),
        0,
      ),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.post.date.localeCompare(a.post.date))
    .slice(0, limit)
    .map((entry) => entry.post);
}
