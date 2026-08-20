import Link from "next/link";
import { PlatformFooter } from "@/components/platform-footer";
import { PlatformHeader } from "@/components/platform-header";
import {
  blogPosts,
  formatBlogDate,
  postPath,
} from "@/lib/blog";

export function BlogIndex() {
  return (
    <>
      <PlatformHeader solid />
      <main id="main">
        <header className="page-header">
          <div className="page-header-inner">
            <p className="eyebrow">Blog</p>
            <h1>Guides for real estate photography studios</h1>
            <p className="lede">
              Alternatives, delivery workflows, pricing math, and migration
              playbooks — written for photographers who sell listing media.
            </p>
          </div>
        </header>
        <section className="page-section" style={{ paddingTop: 0 }}>
          <div className="page-inner blog-index">
            <ul className="blog-post-list">
              {blogPosts.map((post) => (
                <li key={post.slug}>
                  <article className="blog-post-card">
                    <p className="blog-meta">
                      <time dateTime={post.date}>{formatBlogDate(post.date)}</time>
                      <span aria-hidden="true"> · </span>
                      <span>{post.tags.slice(0, 2).join(", ")}</span>
                    </p>
                    <h2>
                      <Link href={postPath(post.slug)}>{post.title}</Link>
                    </h2>
                    <p>{post.description}</p>
                    <Link className="text-link" href={postPath(post.slug)}>
                      Read article
                    </Link>
                  </article>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <PlatformFooter />
    </>
  );
}
