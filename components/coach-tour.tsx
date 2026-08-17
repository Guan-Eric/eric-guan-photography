"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

export type CoachStep = {
  /** CSS selector for the element to highlight (e.g. `[data-tour="work"]`). */
  selector: string;
  title: string;
  body: string;
};

type Rect = { top: number; left: number; width: number; height: number };
type Size = { width: number; height: number };
type Placement = "below" | "above" | "right" | "left" | "center";
type Position = { top: number; left: number; placement: Placement };

/** Viewport margin and gap between the highlighted element and the tip. */
const MARGIN = 12;
const GAP = 12;

function storageKey(tourId: string) {
  return `sf_tour_${tourId}`;
}

function readDone(tourId: string) {
  try {
    return localStorage.getItem(storageKey(tourId)) === "1";
  } catch {
    return true;
  }
}

function writeDone(tourId: string) {
  try {
    localStorage.setItem(storageKey(tourId), "1");
  } catch {
    // ignore quota / private mode
  }
}

function measure(selector: string): Rect | null {
  const el = document.querySelector(selector);
  if (!(el instanceof HTMLElement)) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 && r.height < 2) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/** visualViewport tracks the mobile URL bar and pinch zoom; innerWidth does not. */
function viewport(): Size {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  return {
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight,
  };
}

function clamp(value: number, limit: number) {
  return Math.min(Math.max(MARGIN, value), Math.max(MARGIN, limit));
}

/**
 * Resolve where the tip fits: below the target, else above, else beside it,
 * else centred. Always clamped inside the visual viewport so the card cannot
 * leave the screen regardless of its measured size.
 */
export function resolvePlacement(rect: Rect | null, tip: Size, view: Size): Position {
  const maxLeft = view.width - tip.width - MARGIN;
  const maxTop = view.height - tip.height - MARGIN;

  if (!rect) {
    return {
      top: clamp((view.height - tip.height) / 2, maxTop),
      left: clamp((view.width - tip.width) / 2, maxLeft),
      placement: "center",
    };
  }

  const below = rect.top + rect.height + GAP;
  if (below + tip.height <= view.height - MARGIN) {
    return { top: below, left: clamp(rect.left, maxLeft), placement: "below" };
  }

  const above = rect.top - GAP - tip.height;
  if (above >= MARGIN) {
    return { top: above, left: clamp(rect.left, maxLeft), placement: "above" };
  }

  const right = rect.left + rect.width + GAP;
  if (right + tip.width <= view.width - MARGIN) {
    return { top: clamp(rect.top, maxTop), left: right, placement: "right" };
  }

  const left = rect.left - GAP - tip.width;
  if (left >= MARGIN) {
    return { top: clamp(rect.top, maxTop), left, placement: "left" };
  }

  return {
    top: clamp((view.height - tip.height) / 2, maxTop),
    left: clamp((view.width - tip.width) / 2, maxLeft),
    placement: "center",
  };
}

/**
 * One-time coach marks. Dismissed state lives in localStorage (`sf_tour_${tourId}`).
 */
export function CoachTour({
  tourId,
  steps,
  enabled = true,
}: {
  tourId: string;
  steps: CoachStep[];
  enabled?: boolean;
}) {
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [mounted, setMounted] = useState(false);
  const tipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!enabled || steps.length === 0) return;
    if (readDone(tourId)) return;
    setActive(true);
    setIndex(0);
  }, [enabled, steps.length, tourId]);

  const refresh = useCallback(() => {
    if (!active || !steps[index]) {
      setRect(null);
      return;
    }
    const next = measure(steps[index].selector);
    setRect(next);
    if (next) {
      document.querySelector(steps[index].selector)?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [active, index, steps]);

  useLayoutEffect(() => {
    refresh();
  }, [refresh]);

  /** Measure the rendered card, then place it before paint (no flicker). */
  const reposition = useCallback(() => {
    const node = tipRef.current;
    if (!node) return;
    const box = node.getBoundingClientRect();
    const next = resolvePlacement(
      rect,
      { width: box.width, height: box.height },
      viewport(),
    );
    setPosition((current) =>
      current &&
      Math.abs(current.top - next.top) < 0.5 &&
      Math.abs(current.left - next.left) < 0.5 &&
      current.placement === next.placement
        ? current
        : next,
    );
  }, [rect]);

  useLayoutEffect(() => {
    reposition();
  }, [reposition]);

  useEffect(() => {
    if (!active) return;
    const node = tipRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => reposition());
    observer.observe(node);
    return () => observer.disconnect();
  }, [active, reposition]);

  useEffect(() => {
    if (!active) return;
    const onChange = () => {
      refresh();
      reposition();
    };
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    window.visualViewport?.addEventListener("resize", onChange);
    window.visualViewport?.addEventListener("scroll", onChange);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
      window.visualViewport?.removeEventListener("resize", onChange);
      window.visualViewport?.removeEventListener("scroll", onChange);
    };
  }, [active, refresh, reposition]);

  function finish() {
    writeDone(tourId);
    setActive(false);
  }

  function next() {
    if (index >= steps.length - 1) {
      finish();
      return;
    }
    setPosition(null);
    setIndex((i) => i + 1);
  }

  if (!mounted || !active || steps.length === 0) return null;

  const step = steps[index];
  const tipStyle: CSSProperties = position
    ? { top: position.top, left: position.left }
    : { top: MARGIN, left: MARGIN, visibility: "hidden" };

  const holeStyle: CSSProperties | undefined = rect
    ? {
        top: rect.top - 6,
        left: rect.left - 6,
        width: rect.width + 12,
        height: rect.height + 12,
      }
    : undefined;

  return createPortal(
    <div className="coach-root" role="dialog" aria-modal="true" aria-label={step.title}>
      <div
        className={`coach-overlay${rect ? "" : " coach-overlay--dim"}`}
        onClick={finish}
        aria-hidden="true"
      />
      {holeStyle ? <div className="coach-hole" style={holeStyle} aria-hidden="true" /> : null}
      <div
        className="coach-tip"
        ref={tipRef}
        style={tipStyle}
        data-placement={position?.placement ?? "center"}
      >
        <p className="coach-tip-step">
          {index + 1} / {steps.length}
        </p>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        {!rect ? (
          <p className="coach-tip-miss muted">
            That control isn’t on this screen — skip ahead or open the matching page.
          </p>
        ) : null}
        <div className="coach-tip-actions">
          <button type="button" className="text-link" onClick={finish}>
            Skip
          </button>
          <button type="button" className="btn btn-solid" onClick={next}>
            {index >= steps.length - 1 ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
