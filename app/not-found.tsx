import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-header" id="main">
      <div className="page-header-inner">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p className="section-copy">That link may be expired or mistyped.</p>
        <Link className="btn btn-solid" href="/">
          Go home
        </Link>
      </div>
    </main>
  );
}
