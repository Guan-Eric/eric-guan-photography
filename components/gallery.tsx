"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GalleryImage } from "@/lib/tenant-schema";

/** Horizontal travel, in px, required to register a swipe rather than a tap. */
const SWIPE_THRESHOLD = 45;

export function Gallery({ images }: { images: GalleryImage[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchStartX = useRef<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);

  const step = useCallback(
    (delta: number) => {
      setOpenIndex((current) => {
        if (current === null) return current;
        return (current + delta + images.length) % images.length;
      });
    },
    [images.length],
  );

  // Drive the native dialog from state so Escape, focus trapping, and focus
  // restoration are handled by the browser.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (openIndex === null) {
      if (dialog.open) dialog.close();
      document.body.style.overflow = "";
      return;
    }

    if (!dialog.open) dialog.showModal();
    document.body.style.overflow = "hidden";
  }, [openIndex]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (openIndex === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openIndex, step]);

  const active = openIndex === null ? null : images[openIndex];

  return (
    <>
      <div className="gallery">
        {images.map((image, index) => (
          <figure
            key={image.src}
            className={`gallery-item${image.wide ? " gallery-item--wide" : ""}`}
            data-reveal
          >
            <button
              type="button"
              className="gallery-open"
              onClick={() => setOpenIndex(index)}
              aria-haspopup="dialog"
              aria-label={`View larger photo: ${image.room}`}
            >
              <Image
                src={image.src}
                alt={image.alt}
                width={image.width}
                height={image.height}
                unoptimized={image.src.startsWith("/api/")}
                sizes={
                  image.wide
                    ? "(max-width: 1100px) 100vw, 1040px"
                    : "(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 520px"
                }
                loading="lazy"
              />
            </button>
            <figcaption>
              <span>{image.room}</span>
              <span>{image.note}</span>
            </figcaption>
          </figure>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        className="lightbox"
        aria-label="Photo viewer"
        onClose={close}
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
        onTouchStart={(event) => {
          touchStartX.current = event.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchStartX.current;
          touchStartX.current = null;
          if (start === null) return;

          const delta = (event.changedTouches[0]?.clientX ?? start) - start;
          if (Math.abs(delta) < SWIPE_THRESHOLD) return;
          step(delta < 0 ? 1 : -1);
        }}
      >
        <button
          type="button"
          className="lightbox-close"
          onClick={close}
          aria-label="Close photo viewer"
        >
          Close
        </button>

        {active ? (
          <>
            <figure className="lightbox-figure">
              <Image
                src={active.src}
                alt={active.alt}
                width={active.width}
                height={active.height}
                sizes="(max-width: 1100px) 100vw, 1100px"
                unoptimized={active.src.startsWith("/api/")}
              />
              <figcaption>
                {active.room} · {active.note}
              </figcaption>
            </figure>

            <div className="lightbox-nav">
              <button
                type="button"
                className="lightbox-arrow"
                onClick={() => step(-1)}
                aria-label="Previous photo"
              >
                &#8592;
              </button>
              <span aria-live="polite">
                {(openIndex ?? 0) + 1} / {images.length}
              </span>
              <button
                type="button"
                className="lightbox-arrow"
                onClick={() => step(1)}
                aria-label="Next photo"
              >
                &#8594;
              </button>
            </div>
          </>
        ) : null}
      </dialog>
    </>
  );
}
