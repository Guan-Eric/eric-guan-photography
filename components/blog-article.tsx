import Link from "next/link";
import { PlatformFooter } from "@/components/platform-footer";
import { PlatformHeader } from "@/components/platform-header";
import {
  formatBlogDate,
  markdownToHtml,
  postPath,
  relatedPosts,
  type BlogPost,
} from "@/lib/blog";

function CtaBlock({ cta }: { cta: BlogPost["cta"] }) {
  if (cta === "pricing") {
    return (
      <div className="blog-cta">
        <p>See plans built for listing volume — not portal lock-in.</p>
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/pricing">
            See plans
          </Link>
          <Link className="btn btn-ghost" href="/signup">
            Start 14-day trial
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="blog-cta">
      <p>Run booking, delivery, and pay-to-unlock galleries on your brand.</p>
      <div className="hero-actions">
        <Link className="btn btn-primary" href="/signup">
          Start 14-day trial
        </Link>
        <Link className="btn btn-ghost" href="/pricing">
          See plans
        </Link>
      </div>
    </div>
  );
}

export function BlogArticle({ post }: { post: BlogPost }) {
  const related = relatedPosts(post);
  const html = markdownToHtml(post.body);

  return (
    <>
      <PlatformHeader solid />
      <main id="main">
        <header className="page-header">
          <div className="page-header-inner">
            <p className="eyebrow">
              <Link href="/blog">Blog</Link>
            </p>
            <h1>{post.title}</h1>
            <p className="lede">{post.description}</p>
            <p className="blog-meta">
              <time dateTime={post.date}>{formatBlogDate(post.date)}</time>
              {post.updated ? (
                <>
                  <span aria-hidden="true"> · </span>
                  <span>Updated {formatBlogDate(post.updated)}</span>
                </>
              ) : null}
            </p>
          </div>
        </header>
        <section className="page-section" style={{ paddingTop: 0 }}>
          <div className="page-inner">
            <article
              className="prose blog-prose"
              dangerouslySetInnerHTML={{ __html: html }}
            />
            <CtaBlock cta={post.cta} />
            {related.length > 0 ? (
              <aside className="blog-related" aria-label="Related articles">
                <h2>Related reading</h2>
                <ul>
                  {related.map((item) => (
                    <li key={item.slug}>
                      <Link href={postPath(item.slug)}>{item.title}</Link>
                    </li>
                  ))}
                </ul>
              </aside>
            ) : null}
          </div>
        </section>
      </main>
      <PlatformFooter />
    </>
  );
}
