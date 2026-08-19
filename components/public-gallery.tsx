"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CoachTour, type CoachStep } from "@/components/coach-tour";
import { MediaEmbeds, type EmbedItem } from "@/components/media-embeds";
import { toastError, toastSuccess } from "@/lib/toast";

type GalleryMedia = {
  id: string;
  originalName: string;
  roomLabel: string | null;
  width: number;
  height: number;
};

type Upsell = { id: string; name: string; priceCents: number; summary: string };

const AGENT_GALLERY_TOUR: CoachStep[] = [
  {
    selector: '[data-tour="gallery-grid"]',
    title: "Preview proofs",
    body: "These are watermarked previews. Full-resolution and MLS files unlock after payment.",
  },
  {
    selector: '[data-tour="gallery-pay"]',
    title: "Pay to unlock",
    body: "Add optional add-ons if shown, then pay to download the zip files from this same link.",
  },
];

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
  embeds = [],
  paidFlag,
  cancelledFlag,
  upsells = [],
  allowStubUnlock = false,
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
  embeds?: EmbedItem[];
  paidFlag: boolean;
  cancelledFlag: boolean;
  upsells?: Upsell[];
  allowStubUnlock?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"pay" | "stub" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const unlocked = state === "unlocked";

  // Webhook may lag Stripe return — keep refreshing until DB shows unlocked.
  useEffect(() => {
    if (!paidFlag || unlocked) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      router.refresh();
      if (attempts >= 8) window.clearInterval(timer);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [paidFlag, unlocked, router]);

  const totalCents = useMemo(() => {
    const addOnTotal = upsells
      .filter((item) => selectedAddOns.includes(item.id))
      .reduce((sum, item) => sum + item.priceCents, 0);
    return amountCents + addOnTotal;
  }, [amountCents, selectedAddOns, upsells]);

  const price = useMemo(
    () =>
      new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(totalCents / 100),
    [totalCents, currency],
  );

  function formatAddOn(cents: number) {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  }

  async function checkout(stub = false) {
    setBusy(stub ? "stub" : "pay");
    setError(null);
    try {
      const response = await fetch(`/api/g/${token}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stub, addOnIds: selectedAddOns }),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        alreadyUnlocked?: boolean;
        stubbed?: boolean;
        url?: string | null;
      } | null;
      if (!json || !json.ok) {
        const message = json?.error ?? "Checkout failed.";
        setError(message);
        toastError(message);
        return;
      }
      if (json.alreadyUnlocked || json.stubbed) {
        toastSuccess("Gallery unlocked.");
        router.refresh();
        return;
      }
      if (json.url) {
        toastSuccess("Opening checkout…");
        window.location.href = json.url;
        return;
      }
      setError("Checkout started but no payment link was returned.");
      toastError("Checkout started but no payment link was returned.");
    } catch {
      setError("Network error starting checkout.");
      toastError("Network error starting checkout.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className={`delivery-shell ${branded ? "" : "delivery-shell--unbranded"}`} id="main">
      <header className="delivery-intro">
        {branded ? <p className="eyebrow delivery-brand">{studioName}</p> : null}
        <h1>{title}</h1>
        <p className="lede">{propertyAddress}</p>
      </header>

      <aside className="booking-quote delivery-pay-card" data-tour="gallery-pay">
        {unlocked ? (
          <>
            <p className="eyebrow">Unlocked</p>
            <p className="booking-quote-price">Ready</p>
            <p className="field-hint">Full-resolution and MLS zips are on this same link.</p>
            <div className="delivery-download-row">
              <a
                className="btn btn-solid"
                href={`/api/g/${token}/download?kind=mls${branded ? "" : "&brand=off"}`}
              >
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
            <p className="eyebrow">Your quote</p>
            <p className="booking-quote-price">{price}</p>
            <p className="field-hint">
              Watermarked proofs until payment. Same link unlocks full + MLS files.
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
                    {item.name} (+{formatAddOn(item.priceCents)})
                  </label>
                ))}
              </fieldset>
            ) : null}
            <div className="delivery-download-row">
              <button
                type="button"
                className={`btn btn-solid${busy === "pay" ? " is-busy" : ""}`}
                disabled={busy !== null}
                onClick={() => checkout(false)}
              >
                {busy === "pay" ? "Starting…" : `Pay ${price} & unlock`}
              </button>
              {allowStubUnlock ? (
                <button
                  type="button"
                  className={`btn btn-outline${busy === "stub" ? " is-busy" : ""}`}
                  disabled={busy !== null}
                  onClick={() => checkout(true)}
                >
                  {busy === "stub" ? "Unlocking…" : "Dev stub unlock"}
                </button>
              ) : null}
            </div>
          </>
        )}
        {paidFlag && unlocked ? (
          <p className="form-success">Payment received — files unlocked.</p>
        ) : null}
        {paidFlag && !unlocked ? (
          <p className="muted">Payment received — unlocking downloads…</p>
        ) : null}
        {cancelledFlag && !unlocked ? (
          <p className="muted">Checkout cancelled. Proofs are still available.</p>
        ) : null}
        {error ? <p className="form-error">{error}</p> : null}
      </aside>

      {media.length === 0 ? (
        <div className="booking-card">
          <p>Photos are being prepared. Check back shortly.</p>
        </div>
      ) : (
        <div className="delivery-grid" data-tour="gallery-grid">
          {media.map((asset) => (
            <figure key={asset.id} className="delivery-item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/g/${token}/media/${asset.id}?v=${unlocked ? "web" : "proof"}`}
                alt={asset.roomLabel || "Listing photo"}
                width={asset.width}
                height={asset.height}
                loading="lazy"
              />
              <figcaption>
                {asset.roomLabel ? <span>{asset.roomLabel}</span> : <span />}
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

      <MediaEmbeds items={embeds} />

      <footer className="delivery-footer">
        <p>
          {branded ? `Delivered by ${photographerName}. ` : null}
          <a href="/portal" className="btn btn-solid" style={{ display: "inline-block", padding: "0.4rem 1rem", fontSize: "0.85rem" }}>Your listings</a>
          {branded ? " · Questions? Reply to your booking email." : null}
        </p>
      </footer>
      {!unlocked ? (
        <CoachTour tourId="agent_gallery_v1" steps={AGENT_GALLERY_TOUR} />
      ) : null}
    </main>
  );
}
