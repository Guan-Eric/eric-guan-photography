"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type GalleryMedia = {
  id: string;
  originalName: string;
  roomLabel: string | null;
  width: number;
  height: number;
};

type Upsell = { id: string; name: string; priceCents: number; summary: string };

export function PublicGallery({
  token,
  title,
  propertyAddress,
  amountCents,
  currency,
  state,
  branded,
  studioName,
  photographerName,
  media,
  paidFlag,
  cancelledFlag,
  upsells = [],
}: {
  token: string;
  title: string;
  propertyAddress: string;
  amountCents: number;
  currency: string;
  state: "proofing" | "unlocked" | "archived";
  branded: boolean;
  studioName: string;
  photographerName: string;
  media: GalleryMedia[];
  paidFlag: boolean;
  cancelledFlag: boolean;
  upsells?: Upsell[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const unlocked = state === "unlocked";

  const price = useMemo(
    () =>
      new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(amountCents / 100),
    [amountCents, currency],
  );

  async function checkout(stub = false) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/g/${token}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stub, addOnIds: selectedAddOns }),
      });
      const json = await response.json();
      if (!json.ok) {
        setError(json.error ?? "Checkout failed.");
        return;
      }
      if (json.alreadyUnlocked || json.stubbed) {
        router.refresh();
        return;
      }
      if (json.url) {
        window.location.href = json.url;
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={`delivery-shell ${branded ? "" : "delivery-shell--unbranded"}`} id="main">
      <header className="delivery-header">
        <div>
          {branded ? <p className="eyebrow">{studioName}</p> : null}
          <h1>{title}</h1>
          <p className="lede">{propertyAddress}</p>
        </div>
        <div className="delivery-pay-card">
          {unlocked ? (
            <>
              <p className="eyebrow">Unlocked</p>
              <strong>Full downloads ready</strong>
              <div className="delivery-download-row">
                <a className="btn" href={`/api/g/${token}/download?kind=mls${branded ? "" : "&brand=off"}`}>
                  Download MLS zip
                </a>
                <a
                  className="btn btn-outline"
                  href={`/api/g/${token}/download?kind=full${branded ? "" : "&brand=off"}`}
                >
                  Download full-res zip
                </a>
              </div>
            </>
          ) : (
            <>
              <p className="eyebrow">Proofing</p>
              <strong>{price} to unlock</strong>
              <p className="muted">
                Watermarked proofs only until payment. Same link unlocks full + MLS files.
              </p>
              {upsells.length > 0 ? (
                <fieldset className="upsell-list">
                  <legend>Add-ons</legend>
                  {upsells.map((item) => (
                    <label key={item.id}>
                      <input
                        type="checkbox"
                        checked={selectedAddOns.includes(item.id)}
                        onChange={() =>
                          setSelectedAddOns((current) =>
                            current.includes(item.id)
                              ? current.filter((id) => id !== item.id)
                              : [...current, item.id],
                          )
                        }
                      />
                      {item.name} (+${Math.round(item.priceCents / 100)})
                    </label>
                  ))}
                </fieldset>
              ) : null}
              <div className="delivery-download-row">
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => checkout(false)}
                >
                  {busy ? "Starting…" : "Pay & unlock"}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={busy}
                  onClick={() => checkout(true)}
                >
                  Local stub unlock
                </button>
              </div>
            </>
          )}
          {paidFlag ? <p className="form-success">Payment received — files unlocked.</p> : null}
          {cancelledFlag ? <p className="muted">Checkout cancelled. Proofs are still available.</p> : null}
          {error ? <p className="form-error">{error}</p> : null}
        </div>
      </header>

      {media.length === 0 ? (
        <div className="booking-card">
          <p>Photos are being prepared. Check back shortly.</p>
        </div>
      ) : (
        <div className="delivery-grid">
          {media.map((asset) => (
            <figure key={asset.id} className="delivery-item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/g/${token}/media/${asset.id}?v=${unlocked ? "web" : "proof"}`}
                alt={asset.roomLabel ?? asset.originalName}
                width={asset.width}
                height={asset.height}
                loading="lazy"
              />
              <figcaption>
                <span>{asset.roomLabel ?? asset.originalName}</span>
                {unlocked ? (
                  <span className="delivery-item-links">
                    <a href={`/api/g/${token}/media/${asset.id}?v=mls`}>MLS</a>
                    <a href={`/api/g/${token}/media/${asset.id}?v=full`}>Full</a>
                  </span>
                ) : (
                  <span>Proof</span>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {branded ? (
        <footer className="delivery-footer">
          <p>
            Delivered by {photographerName}. Questions? Reply to your booking email.
          </p>
        </footer>
      ) : null}
    </main>
  );
}
