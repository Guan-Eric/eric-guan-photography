"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { PlatformFooter } from "@/components/platform-footer";
import { PlatformHeader } from "@/components/platform-header";
import { LIFETIME_USD, PLAN_DEFS } from "@/lib/plan-defs";
import { formatUsd } from "@/lib/plan-compare";

type Offer = {
  enabled: boolean;
  open: boolean;
  cap: number;
  remaining: number;
  priceUsd: number;
  listingQuota: number;
  seats: number;
};

const SCENE_MS = 14_000;

/** Listing photos already used on the marketing site (Unsplash). */
const DEMO_THUMBS = [
  {
    src: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=640&q=80",
    alt: "Living room with large windows",
  },
  {
    src: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=640&q=80",
    alt: "Modern kitchen with island",
  },
  {
    src: "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=640&q=80",
    alt: "Primary bedroom with soft daylight",
  },
  {
    src: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=640&q=80",
    alt: "Home exterior with landscaping",
  },
  {
    src: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=640&q=80",
    alt: "Bathroom with clean finishes",
  },
  {
    src: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=640&q=80",
    alt: "Dining area with outdoor light",
  },
] as const;

const SCENES = [
  {
    id: "book",
    kicker: "1 / Book",
    caption: "The agent books on your branded site.",
  },
  {
    id: "shoot",
    kicker: "2 / Shoot",
    caption: "You shoot the listing and upload the photos.",
  },
  {
    id: "gallery",
    kicker: "3 / Gallery",
    caption: "They get a link. Watermarked proofs. No agent account.",
  },
  {
    id: "pay",
    kicker: "4 / Unlock",
    caption: "They pay in the gallery and unlock the zips.",
  },
  {
    id: "close",
    kicker: "5 / Lifetime",
    caption:
      "Lifetime Starter is $199 once. Caps: 125 listings a year, 1 seat, subdomain.",
  },
] as const;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  return reduced;
}

export function PlatformSilentDemo({ offer }: { offer: Offer }) {
  const price = formatUsd(offer.priceUsd || LIFETIME_USD);
  const ctaHref = offer.open ? "/signup?plan=lifetime" : "/pricing";
  const ctaLabel = offer.open
    ? `Get Lifetime for ${price}`
    : offer.enabled
      ? "Sold out. See monthly plans"
      : "Offer closed. See monthly plans";
  const reduced = usePrefersReducedMotion();
  const lastIndex = SCENES.length - 1;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const goNext = useCallback(() => {
    setIndex((current) => Math.min(current + 1, lastIndex));
  }, [lastIndex]);

  const goBack = useCallback(() => {
    setIndex((current) => Math.max(0, current - 1));
  }, []);

  useEffect(() => {
    if (reduced) {
      setIndex(lastIndex);
      setPaused(true);
    }
  }, [lastIndex, reduced]);

  useEffect(() => {
    if (paused || reduced || index >= lastIndex) return;
    const timer = window.setTimeout(goNext, SCENE_MS);
    return () => window.clearTimeout(timer);
  }, [goNext, index, lastIndex, paused, reduced]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (reduced) return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
        setPaused(false);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goBack();
        setPaused(false);
        return;
      }
      if (event.key === " " || event.key === "Spacebar") {
        if (tag === "BUTTON" || tag === "A") return;
        if (index >= lastIndex) return;
        event.preventDefault();
        setPaused((value) => !value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goBack, goNext, index, lastIndex, reduced]);

  const scene = SCENES[index] ?? SCENES[0];

  function onStageClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("a") || target.closest(".silent-demo-controls")) return;
    if (reduced || index >= lastIndex) return;
    goNext();
    setPaused(false);
  }

  return (
    <>
      <PlatformHeader solid />
      <main id="main">
        <header className="page-header">
          <div className="page-header-inner">
            <p className="eyebrow">Silent walkthrough</p>
            <h1>Book, deliver, get paid. No talking.</h1>
            <p className="section-copy">
              About 70 seconds. Captions only. Click a scene or use the arrow
              keys to skip. Space pauses.
            </p>
          </div>
        </header>

        <section className="page-section silent-demo" style={{ paddingTop: 0 }}>
          <div className="page-inner">
            <div
              className={`silent-demo-player${paused ? " is-paused" : ""}${
                reduced ? " is-reduced" : ""
              }`}
              role="region"
              aria-label="Silent product walkthrough"
            >
              <div
                className="silent-demo-stage"
                data-scene={scene.id}
                onClick={onStageClick}
                title={index < lastIndex ? "Click to skip ahead" : undefined}
              >
                <SceneVisual
                  key={scene.id}
                  id={scene.id}
                  offer={offer}
                  price={price}
                  ctaHref={ctaHref}
                  ctaLabel={ctaLabel}
                />
                <p className="silent-demo-caption" aria-live="polite">
                  <span className="eyebrow">{scene.kicker}</span>
                  {scene.caption}
                </p>
              </div>

              {reduced || index >= lastIndex ? (
                <div className="silent-demo-progress is-still" aria-hidden="true" />
              ) : (
                <div
                  key={`${index}-progress`}
                  className="silent-demo-progress"
                  aria-hidden="true"
                />
              )}

              <div className="silent-demo-controls">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setPaused((value) => !value)}
                  disabled={reduced || index >= lastIndex}
                >
                  {paused ? "Play" : "Pause"}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    goBack();
                    setPaused(false);
                  }}
                  disabled={index === 0}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    goNext();
                    setPaused(false);
                  }}
                  disabled={index >= lastIndex}
                >
                  Next
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    if (reduced) {
                      setIndex(lastIndex);
                      setPaused(true);
                      return;
                    }
                    setIndex(0);
                    setPaused(false);
                  }}
                >
                  Replay
                </button>
                <ol className="silent-demo-dots">
                  {SCENES.map((item, sceneIndex) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={sceneIndex === index ? "is-active" : undefined}
                        aria-current={sceneIndex === index ? "step" : undefined}
                        aria-label={`Show ${item.kicker}`}
                        onClick={() => {
                          setIndex(sceneIndex);
                          setPaused(false);
                        }}
                      />
                    </li>
                  ))}
                </ol>
              </div>
              <p className="muted silent-demo-hint">
                Click the stage to skip. Arrow keys move. Space pauses.
              </p>

              {reduced ? (
                <ol className="silent-demo-script">
                  {SCENES.map((item) => (
                    <li key={item.id}>
                      <strong>{item.kicker}</strong>
                      <span>{item.caption}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>

            <div className="hero-actions">
              <Link
                className={`btn btn-solid${!offer.open ? " is-disabled" : ""}`}
                href={ctaHref}
                aria-disabled={!offer.open}
              >
                {ctaLabel}
              </Link>
              <Link className="btn btn-outline" href="/lifetime">
                Caps and FAQ
              </Link>
            </div>
          </div>
        </section>
      </main>
      <PlatformFooter />
    </>
  );
}

function SceneVisual({
  id,
  offer,
  price,
  ctaHref,
  ctaLabel,
}: {
  id: (typeof SCENES)[number]["id"];
  offer: Offer;
  price: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  if (id === "book") {
    return (
      <div className="silent-demo-chrome">
        <p className="silent-demo-url">yours.studiofront.ca/book</p>
        <div className="silent-demo-card">
          <p className="eyebrow">Book a shoot</p>
          <h3 className="silent-demo-type">1428 Pine Avenue</h3>
          <p className="muted silent-demo-fade">
            Listing photos · Preferred Thursday 10:00
          </p>
          <span className="btn btn-solid silent-demo-target" aria-hidden="true">
            Request booking
          </span>
          <p className="silent-demo-check">Booked. Confirmation sent.</p>
          <span className="silent-demo-pointer" aria-hidden="true" />
        </div>
      </div>
    );
  }

  if (id === "shoot") {
    return (
      <div className="silent-demo-chrome">
        <p className="silent-demo-url">Studio · Upload</p>
        <div className="silent-demo-thumbs" aria-hidden="true">
          {DEMO_THUMBS.map((thumb, index) => (
            <span key={thumb.src} className={`silent-demo-thumb is-${index}`}>
              <img
                src={thumb.src}
                alt=""
                width={640}
                height={480}
                loading="lazy"
                decoding="async"
              />
            </span>
          ))}
        </div>
        <div className="silent-demo-bar" aria-hidden="true">
          <span />
        </div>
        <p className="muted">Uploading 24 photos…</p>
      </div>
    );
  }

  if (id === "gallery") {
    return (
      <div className="silent-demo-chrome">
        <p className="silent-demo-url">yours.studiofront.ca/g/ready</p>
        <div className="silent-demo-thumbs is-proof" aria-hidden="true">
          {DEMO_THUMBS.map((thumb, index) => (
            <span key={thumb.src} className={`silent-demo-thumb is-${index}`}>
              <img
                src={thumb.src}
                alt=""
                width={640}
                height={480}
                loading="lazy"
                decoding="async"
              />
              <em>PROOF</em>
            </span>
          ))}
        </div>
        <p className="muted">Watermarked proofs. No login.</p>
      </div>
    );
  }

  if (id === "pay") {
    return (
      <div className="silent-demo-chrome">
        <p className="silent-demo-url">Same gallery link</p>
        <div className="silent-demo-card">
          <p className="eyebrow">Pay to unlock</p>
          <h3>Full-res + MLS zip</h3>
          <p className="muted">Same link. Checkout unlocks the files.</p>
          <span className="btn btn-solid silent-demo-target" aria-hidden="true">
            Pay &amp; unlock
          </span>
          <div className="silent-demo-zips" aria-hidden="true">
            <span>MLS.zip</span>
            <span>Full-res.zip</span>
          </div>
          <span className="silent-demo-pointer" aria-hidden="true" />
        </div>
      </div>
    );
  }

  return (
    <div className="silent-demo-chrome">
      <p className="silent-demo-url">studiofront.ca/lifetime</p>
      <div className="silent-demo-card silent-demo-close">
        <p className="eyebrow">Founding offer</p>
        <h3>
          {PLAN_DEFS.lifetime.label} {price}
        </h3>
        <p className="muted">
          {offer.listingQuota} listings / year · {offer.seats} seat · subdomain
          only
        </p>
        <div className="silent-demo-cta">
          <Link
            className={`btn btn-solid${!offer.open ? " is-disabled" : ""}`}
            href={ctaHref}
            aria-disabled={!offer.open}
          >
            {ctaLabel}
          </Link>
          <Link className="btn btn-outline" href="/lifetime">
            Caps and FAQ
          </Link>
        </div>
      </div>
    </div>
  );
}
