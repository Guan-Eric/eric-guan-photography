"use client";

import { useState } from "react";

export function ListingDomainCta({ slug }: { slug: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/p/${slug}/domain`, { method: "POST" });
      const json = await response.json().catch(() => null);
      if (json?.stubbed) {
        window.location.reload();
        return;
      }
      if (json?.url) {
        window.location.href = json.url;
        return;
      }
      setError(json?.error ?? "Checkout is not available yet.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="listing-copy">
      <h2>Custom listing URL</h2>
      <p>Put this property on its own hostname. One year, billed to this listing.</p>
      {error ? <p className="form-error">{error}</p> : null}
      <button type="button" className="btn btn-solid" disabled={busy} onClick={buy}>
        {busy ? "Opening checkout…" : "Get a custom domain"}
      </button>
    </section>
  );
}
