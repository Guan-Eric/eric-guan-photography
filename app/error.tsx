"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page-header" id="main">
      <div className="page-header-inner">
        <p className="eyebrow">Error</p>
        <h1>Something went wrong</h1>
        <p className="section-copy">Try again, or refresh the page.</p>
        <button type="button" className="btn btn-solid" onClick={() => reset()}>
          Try again
        </button>
      </div>
    </main>
  );
}
