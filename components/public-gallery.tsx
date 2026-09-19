"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CoachTour, type CoachStep } from "@/components/coach-tour";
import { MediaEmbeds, type EmbedItem } from "@/components/media-embeds";
import { marketingLicense } from "@/lib/legal-copy";
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
    body: "Add optional add-ons if shown, then pay. You’ll get a new download link by email — the preview link stops working.",
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
  licenseAccepted = false,
  preferFrenchLicense = false,
  listingsHref = "/portal",
  allowPortalDevBypass = false,
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
  licenseAccepted?: boolean;
  preferFrenchLicense?: boolean;
  listingsHref?: string;
  allowPortalDevBypass?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"pay" | "stub" | "license" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [licenseChecked, setLicenseChecked] = useState(false);
  const [licenseOk, setLicenseOk] = useState(licenseAccepted);
  const [licenseLang, setLicenseLang] = useState<"en" | "fr">(
    preferFrenchLicense ? "fr" : "en",
  );
  const unlocked = state === "unlocked";

  useEffect(() => {
    setLicenseOk(licenseAccepted);
  }, [licenseAccepted]);

  useEffect(() => {
    setLicenseLang(preferFrenchLicense ? "fr" : "en");
  }, [preferFrenchLicense]);

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
        galleryUrl?: string;
      } | null;
      if (!json || !json.ok) {
        const message = json?.error ?? "Checkout failed.";
        setError(message);
        toastError(message);
        return;
      }
      if (json.stubbed && json.galleryUrl) {
        toastSuccess("Gallery unlocked — opening your download link.");
        window.location.href = `${json.galleryUrl}${json.galleryUrl.includes("?") ? "&" : "?"}paid=1`;
        return;
      }
      if (json.alreadyUnlocked) {
        toastSuccess("Gallery unlocked.");
        if (json.galleryUrl) {
          window.location.href = json.galleryUrl;
          return;
        }
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

  async function acceptLicense() {
    if (!licenseChecked) {
      setError(
        licenseLang === "fr"
          ? "Cochez la case pour accepter la licence de marketing limitée."
          : "Check the box to accept the Limited Marketing License.",
      );
      return;
    }
    setBusy("license");
    setError(null);
    try {
      const response = await fetch(`/api/g/${token}/license`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: licenseLang }),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!json?.ok) {
        const message = json?.error ?? "Could not save license acceptance.";
        setError(message);
        toastError(message);
        return;
      }
      setLicenseOk(true);
      toastSuccess(marketingLicense[licenseLang].accepted);
      router.refresh();
    } catch {
      setError("Network error saving license acceptance.");
      toastError("Network error saving license acceptance.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className={`delivery-shell ${branded ? "" : "delivery-shell--unbranded"}`} id="main">
      <div className="delivery-main">
        <header className="delivery-intro">
          {branded ? <p className="eyebrow delivery-brand">{studioName}</p> : null}
          <h1>{title}</h1>
          <p className="lede">{propertyAddress}</p>
          {!unlocked ? (
            <p className="delivery-copyright-banner" role="note">
              © {branded ? photographerName : "Photographer"}. Watermarked proofs for review only.
              This link is for the booking agent — do not publish or share with other brokerages.
              Screenshots are not licensed for MLS.
            </p>
          ) : null}
          <div className="delivery-portal-callout">
            <div className="delivery-portal-callout-copy">
              <p className="eyebrow">Agent portal</p>
              <p>
                {branded
                  ? `See every shoot you’ve booked with ${studioName} — this listing and past orders.`
                  : "See every shoot you’ve booked with this photographer — this listing and past orders."}{" "}
                Sign in with your email; no password.
              </p>
            </div>
            {allowPortalDevBypass ? (
              <form
                className="delivery-portal-callout-link"
                action="/api/portal/dev-bypass"
                method="POST"
              >
                <input type="hidden" name="galleryToken" value={token} />
                <button className="btn btn-outline" type="submit">
                  Your listings
                </button>
              </form>
            ) : (
              <Link
                className="btn btn-outline delivery-portal-callout-link"
                href={listingsHref}
              >
                Your listings
              </Link>
            )}
          </div>
        </header>

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
                  {unlocked && licenseOk ? (
                    <span className="delivery-item-links">
                      <a href={`/api/g/${token}/media/${asset.id}?v=mls`}>MLS</a>
                      <a href={`/api/g/${token}/media/${asset.id}?v=full`}>Full</a>
                    </span>
                  ) : unlocked ? (
                    <span>Accept license to download</span>
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
            {branded
              ? `Delivered by ${photographerName}. Questions? Reply to your booking email.`
              : "Questions? Reply to your booking email."}
          </p>
        </footer>
        {!unlocked ? (
          <CoachTour tourId="agent_gallery_v1" steps={AGENT_GALLERY_TOUR} />
        ) : null}
      </div>

      <aside className="booking-quote delivery-pay-card" data-tour="gallery-pay">
        {unlocked ? (
          <>
            <p className="eyebrow">Unlocked</p>
            <p className="booking-quote-price">Ready</p>
            {licenseOk ? (
              <>
                <p className="field-hint">
                  Full-resolution and MLS zips are ready on this download link.
                </p>
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
                <p className="field-hint">{marketingLicense[licenseLang].prompt}</p>
                {preferFrenchLicense && licenseLang === "fr" ? (
                  <p className="field-hint">
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => setLicenseLang("en")}
                    >
                      {marketingLicense.fr.continueEn}
                    </button>
                  </p>
                ) : preferFrenchLicense && licenseLang === "en" ? (
                  <p className="field-hint">
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => setLicenseLang("fr")}
                    >
                      Afficher en français
                    </button>
                  </p>
                ) : null}
                <label className="delivery-license-check" lang={licenseLang}>
                  <input
                    type="checkbox"
                    checked={licenseChecked}
                    onChange={(event) => setLicenseChecked(event.target.checked)}
                  />
                  <span>
                    {marketingLicense[licenseLang].summary}{" "}
                    <Link
                      href={licenseLang === "fr" ? "/fr/terms" : "/terms"}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {marketingLicense[licenseLang].title}
                    </Link>
                  </span>
                </label>
                <div className="delivery-download-row">
                  <button
                    type="button"
                    className={`btn btn-solid${busy === "license" ? " is-busy" : ""}`}
                    disabled={busy !== null || !licenseChecked}
                    onClick={() => void acceptLicense()}
                  >
                    {busy === "license"
                      ? "…"
                      : marketingLicense[licenseLang].accept}
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <p className="eyebrow">Your quote</p>
            <p className="booking-quote-price">{price}</p>
            <p className="field-hint">
              Watermarked proofs until payment. After payment you’ll get a new download link by
              email — this preview link will stop working.
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
    </main>
  );
}
