import { describe, expect, it } from "vitest";
import { markdownToHtml } from "@/lib/blog-markdown";
import { blogPosts, getBlogPost } from "@/lib/blog";

describe("markdownToHtml", () => {
  it("renders headings, links, lists, and tables", () => {
    const html = markdownToHtml(`## Hello

See the [pricing](/pricing) page and **pay attention**.

- one
- two

| A | B |
| --- | --- |
| 1 | 2 |
`);
    expect(html).toContain("<h2>Hello</h2>");
    expect(html).toContain('<a href="/pricing">pricing</a>');
    expect(html).toContain("<strong>pay attention</strong>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<table>");
    expect(html).toContain("<th>A</th>");
  });
});

describe("blogPosts", () => {
  it("registers unique slugs for every planned article", () => {
    const slugs = blogPosts.map((post) => post.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.length).toBe(26);
    expect(getBlogPost("aryeo-alternative")?.title).toMatch(/Aryeo Alternative/);
    expect(getBlogPost("get-paid-faster-real-estate-photographer")).toBeTruthy();
  });
});
