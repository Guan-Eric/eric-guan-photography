export type BlogCta = "trial" | "pricing";

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  updated?: string;
  tags: string[];
  cta: BlogCta;
  /** Markdown body (no frontmatter). */
  body: string;
};

export function postPath(slug: string) {
  return `/blog/${slug}`;
}
