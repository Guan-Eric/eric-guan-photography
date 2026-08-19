"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import type { Order, OrderStatus } from "@/lib/db/schema";
import {
  ORDER_STATUSES,
  isManualOrderStatus,
  orderStatusLabel,
} from "@/lib/db/schema";
import type { GallerySummary } from "@/lib/galleries";
import { allowedManualStatuses, confirmBlockers } from "@/lib/order-flow";
import {
  parsePreferredSlotsJson,
  type PreferredSlot,
} from "@/lib/preferred-slots";
import { AdminGettingStarted } from "@/components/admin-getting-started";
import { OrderMediaLinks } from "@/components/order-media-links";
import { toastError, toastSuccess } from "@/lib/toast";

const VIEW_KEY = "sf_board_view";
type BoardView = "grid" | "list";

function formatMoney(cents: number, currency: string) {
  if (cents <= 0) return "Quote later";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatSlot(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function slotOrdinal(index: number) {
  return index === 0 ? "1st" : index === 1 ? "2nd" : "3rd";
}

function OrderSlotPicker({
  orderId,
  preferred,
  selectedStart,
  onSelect,
  legend,
}: {
  orderId: string;
  preferred: PreferredSlot[];
  selectedStart: string;
  onSelect: (start: string) => void;
  legend?: string;
}) {
  if (preferred.length === 0) return null;
  return (
    <fieldset className="order-slot-pick">
      <legend className={legend ? undefined : "visually-hidden"}>
        {legend ?? "Pick the shoot time to confirm"}
      </legend>
      {preferred.map((slot, index) => (
        <label key={slot.start}>
          <input
            type="radio"
            name={`slot-${orderId}`}
            checked={selectedStart === slot.start}
            onChange={() => onSelect(slot.start)}
          />
          <span>
            {slotOrdinal(index)}: {slot.label}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function mediaBadges(gallery: GallerySummary | null) {
  if (!gallery) return [];
  const badges: string[] = [];
  if (gallery.mediaCount > 0) {
    badges.push(`${gallery.mediaCount} photo${gallery.mediaCount === 1 ? "" : "s"}`);
  }
  if (gallery.videoCount > 0) badges.push(`${gallery.videoCount} video`);
  if (gallery.tourCount > 0) badges.push(`${gallery.tourCount} tour`);
  if (gallery.floorPlanCount > 0) badges.push(`${gallery.floorPlanCount} floor plan`);
  if (gallery.brandMode === "unbranded") badges.push("unbranded");
  return badges;
}

function deliveryPhase(
  gallery: GallerySummary | null,
  orderStatus: OrderStatus,
): 1 | 2 | 3 | 4 {
  if (orderStatus === "paid") return 4;
  if (orderStatus === "delivered") return 3;
  if (gallery && gallery.mediaCount > 0) return 2;
  return 1;
}

export function AdminOrderBoard({
  initialOrders,
  initialGalleries,
  bookingUrl,
  siteUrl,
  welcome = false,
  plan = null,
}: {
  initialOrders: Order[];
  initialGalleries: GallerySummary[];
  bookingUrl: string;
  siteUrl: string;
  welcome?: boolean;
  plan?: string | null;
}) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [galleries, setGalleries] = useState(initialGalleries);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<{
    orderId: string;
    action:
      | "confirm"
      | "cancel"
      | "status"
      | "savePrice"
      | "saveAddress"
      | "upload"
      | "publish"
      | "unlock";
  } | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [links, setLinks] = useState<
    Record<string, { branded: string; unbranded: string; listing?: string }>
  >({});
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [slotDrafts, setSlotDrafts] = useState<Record<string, string>>({});
  const [addressDrafts, setAddressDrafts] = useState<
    Record<
      string,
      {
        propertyAddress: string;
        postalCode: string;
        city: string;
        placeId: string;
        mapLat: string;
        mapLng: string;
      }
    >
  >({});
  const [view, setView] = useState<BoardView>("grid");
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function fail(message: string) {
    setError(message);
    toastError(message);
  }

  function ok(message: string) {
    setNotice(message);
    toastSuccess(message);
  }

  function addressDraft(order: Order) {
    return (
      addressDrafts[order.id] ?? {
        propertyAddress: order.propertyAddress,
        postalCode: order.postalCode,
        city: order.city ?? "",
        placeId: order.placeId ?? "",
        mapLat: order.mapLat ?? "",
        mapLng: order.mapLng ?? "",
      }
    );
  }

  function patchAddressDraft(
    orderId: string,
    order: Order,
    patch: Partial<(typeof addressDrafts)[string]>,
  ) {
    setAddressDrafts((current) => ({
      ...current,
      [orderId]: {
        ...(current[orderId] ?? {
          propertyAddress: order.propertyAddress,
          postalCode: order.postalCode,
          city: order.city ?? "",
          placeId: order.placeId ?? "",
          mapLat: order.mapLat ?? "",
          mapLng: order.mapLng ?? "",
        }),
        ...patch,
      },
    }));
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "grid" || saved === "list") setView(saved);
    } catch {
      // ignore private mode
    }
  }, []);

  function chooseView(next: BoardView) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // ignore quota / private mode
    }
  }

  function isExpanded(orderId: string) {
    return expandedIds.has(orderId);
  }

  function toggleExpanded(orderId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  function expandAllVisible() {
    setExpandedIds((current) => {
      const next = new Set(current);
      for (const order of visibleOrders) next.add(order.id);
      return next;
    });
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  const visibleOrders =
    statusFilter === "all"
      ? orders
      : orders.filter((order) => order.status === statusFilter);

  function galleryUrl(token: string, brand: "branded" | "unbranded" = "branded") {
    const url = new URL(`/g/${token}`, `${siteUrl}/`);
    if (brand === "unbranded") url.searchParams.set("brand", "off");
    return url.toString();
  }

  async function copyText(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      ok("Copied to clipboard.");
      window.setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      fail("Could not copy to clipboard.");
    }
  }

  function galleryFor(orderId: string) {
    return galleries.find((gallery) => gallery.orderId === orderId) ?? null;
  }

  async function setStatus(
    orderId: string,
    status: OrderStatus,
    extra?: Record<string, unknown>,
  ) {
    setError(null);
    setBusy({
      orderId,
      action:
        status === "confirmed"
          ? "confirm"
          : status === "cancelled"
            ? "cancel"
            : "status",
    });
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extra }),
      });
      const json = await response.json();
      if (!json.ok) {
        fail(json.error ?? "Could not update status.");
        return;
      }
      setOrders((current) =>
        current.map((order) => (order.id === orderId ? json.order : order)),
      );
      ok("Status updated.");
    } catch {
      fail("Network error updating status.");
    } finally {
      setBusy(null);
    }
  }

  async function savePrice(orderId: string) {
    setError(null);
    const order = orders.find((row) => row.id === orderId);
    const raw =
      priceDrafts[orderId] ??
      (order && order.priceCents > 0
        ? String(Math.round(order.priceCents / 100))
        : "");
    const dollars = Number(raw);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      fail("Enter a price greater than zero.");
      return;
    }
    setBusy({ orderId, action: "savePrice" });
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceCents: Math.round(dollars * 100) }),
      });
      const json = await response.json();
      if (!json.ok) {
        fail(json.error ?? "Could not update price.");
        return;
      }
      setOrders((current) =>
        current.map((order) => (order.id === orderId ? json.order : order)),
      );
      ok("Price saved.");
      setPriceDrafts((current) => {
        const next = { ...current };
        delete next[orderId];
        return next;
      });
    } catch {
      fail("Network error saving price.");
    } finally {
      setBusy(null);
    }
  }

  async function saveAddress(orderId: string) {
    const order = orders.find((row) => row.id === orderId);
    if (!order) return;
    const draft = addressDraft(order);
    setError(null);
    setBusy({ orderId, action: "saveAddress" });
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyAddress: draft.propertyAddress,
          postalCode: draft.postalCode,
          city: draft.city || undefined,
          placeId: draft.placeId || null,
          mapLat: draft.mapLat || null,
          mapLng: draft.mapLng || null,
        }),
      });
      const json = await response.json();
      if (!json.ok) {
        fail(json.error ?? "Could not update address.");
        return;
      }
      setOrders((current) =>
        current.map((row) => (row.id === orderId ? json.order : row)),
      );
      setAddressDrafts((current) => {
        const next = { ...current };
        delete next[orderId];
        return next;
      });
      ok("Address saved.");
    } catch {
      fail("Network error saving address.");
    } finally {
      setBusy(null);
    }
  }

  async function uploadPhotos(orderId: string) {
    const input = fileRefs.current[orderId];
    if (!input?.files?.length) {
      fail("Choose one or more photos to upload.");
      return;
    }

    setBusy({ orderId, action: "upload" });
    setError(null);
    const form = new FormData();
    Array.from(input.files).forEach((file) => form.append("files", file));

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/upload`, {
        method: "POST",
        body: form,
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        galleryId?: string;
        state?: GallerySummary["state"];
        token?: string;
        uploaded?: number;
      } | null;
      if (!response.ok || !json?.ok) {
        fail(json?.error ?? `Upload failed (${response.status}).`);
        return;
      }

      setGalleries((current) => {
        const previous = galleryFor(orderId);
        const without = current.filter((gallery) => gallery.orderId !== orderId);
        return [
          ...without,
          {
            id: json.galleryId!,
            orderId,
            state: json.state!,
            publicToken: json.token!,
            trustTier: previous?.trustTier ?? ("pay_first" as const),
            brandMode: previous?.brandMode ?? ("branded" as const),
            mediaCount: (previous?.mediaCount ?? 0) + (json.uploaded ?? 0),
            coverAssetId: previous?.coverAssetId ?? null,
            coverWidth: previous?.coverWidth ?? null,
            coverHeight: previous?.coverHeight ?? null,
            videoCount: previous?.videoCount ?? 0,
            tourCount: previous?.tourCount ?? 0,
            floorPlanCount: previous?.floorPlanCount ?? 0,
          },
        ];
      });
      input.value = "";
      setFileNames((current) => ({ ...current, [orderId]: "" }));
      ok(
        `Uploaded ${json.uploaded ?? 0} photo${(json.uploaded ?? 0) === 1 ? "" : "s"}.`,
      );
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error && /abort|timeout/i.test(error.message)
          ? "Upload timed out. Try fewer or smaller photos."
          : "Network error during upload.";
      fail(message);
    } finally {
      setBusy(null);
    }
  }

  async function publish(orderId: string) {
    setBusy({ orderId, action: "publish" });
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      });
      const json = await response.json();
      if (!json.ok) {
        fail(json.error ?? "Could not publish.");
        return;
      }
      setGalleries((current) =>
        current.map((gallery) =>
          gallery.orderId === orderId
            ? {
                ...gallery,
                state: json.gallery.state,
                publicToken: json.gallery.publicToken,
                trustTier: json.gallery.trustTier,
              }
            : gallery,
        ),
      );
      setLinks((current) => ({
        ...current,
        [orderId]: {
          branded: json.brandedUrl,
          unbranded: json.unbrandedUrl,
          listing: json.listingUrl ?? "",
        },
      }));
      setOrders((current) =>
        current.map((order) =>
          order.id === orderId ? { ...order, status: "delivered" } : order,
        ),
      );
      if (json.listingSkipped) {
        ok(
          json.listingError
            ? `Gallery published. Listing page skipped: ${json.listingError}`
            : "Gallery published. Listing pages are not on this plan.",
        );
      } else if (json.emailError) {
        fail(`Gallery published, but email failed: ${json.emailError}`);
      } else if (json.emailStubbed) {
        ok("Gallery published. Email was logged locally (no RESEND_API_KEY).");
      } else if (json.emailSent) {
        ok("Gallery published and email sent to the agent.");
      } else {
        ok("Gallery published.");
      }
    } finally {
      setBusy(null);
    }
  }

  async function forceUnlock(orderId: string) {
    setBusy({ orderId, action: "unlock" });
    setError(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlock", markPaid: true }),
      });
      const json = await response.json();
      if (!json.ok) {
        fail(json.error ?? "Could not unlock.");
        return;
      }
      setGalleries((current) =>
        current.map((gallery) =>
          gallery.orderId === orderId
            ? { ...gallery, state: json.gallery.state }
            : gallery,
        ),
      );
      setOrders((current) =>
        current.map((order) =>
          order.id === orderId ? { ...order, status: "paid" } : order,
        ),
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="admin-board">
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">Orders</p>
          <h1>Shoots</h1>
          <p className="muted">
            Confirm times, set the price, then deliver the gallery from one board.
          </p>
        </div>
        <a className="btn btn-outline" href={bookingUrl} target="_blank" rel="noreferrer">
          Booking page
        </a>
      </div>

      <AdminGettingStarted
        bookingUrl={bookingUrl}
        welcome={welcome}
        plan={plan}
      />

      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="form-success">{notice}</p> : null}

      {orders.length === 0 ? (
        <div className="studio-empty">
          <h2>No shoots yet</h2>
          <p>When an agent books, the job lands on this board.</p>
          <a className="btn btn-solid" href={bookingUrl} target="_blank" rel="noreferrer">
            Open booking page
          </a>
        </div>
      ) : (
        <>
          <div className="admin-order-filters">
            <label className="field">
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "all" | OrderStatus)
                }
              >
                <option value="all">All ({orders.length})</option>
                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {orderStatusLabel(status)} (
                    {orders.filter((order) => order.status === status).length})
                  </option>
                ))}
              </select>
            </label>
            <div className="admin-order-collapse-tools">
              <div className="admin-order-view" role="group" aria-label="Board layout">
                <button
                  type="button"
                  className={view === "grid" ? "is-active" : undefined}
                  aria-pressed={view === "grid"}
                  onClick={() => chooseView("grid")}
                >
                  Cards
                </button>
                <button
                  type="button"
                  className={view === "list" ? "is-active" : undefined}
                  aria-pressed={view === "list"}
                  onClick={() => chooseView("list")}
                >
                  List
                </button>
              </div>
              <button type="button" className="text-link" onClick={expandAllVisible}>
                Expand all
              </button>
              <button type="button" className="text-link" onClick={collapseAll}>
                Collapse all
              </button>
            </div>
          </div>
          <div className={`admin-order-list is-${view}`}>
            {visibleOrders.map((order) => {
              const gallery = galleryFor(order.id);
              const orderLinks = links[order.id];
              const orderLocked = busy?.orderId === order.id;
              const pending = (action: NonNullable<typeof busy>["action"]) =>
                orderLocked && busy?.action === action;
              const phase = deliveryPhase(gallery, order.status);
              const branded =
                orderLinks?.branded ??
                (gallery ? galleryUrl(gallery.publicToken, "branded") : null);
              const unbranded =
                orderLinks?.unbranded ??
                (gallery ? galleryUrl(gallery.publicToken, "unbranded") : null);
              const published =
                order.status === "delivered" || order.status === "paid";
              const paid = order.status === "paid";
              const expanded = isExpanded(order.id);
              const preferred = parsePreferredSlotsJson(order.preferredSlotsJson);
              const selectedStart =
                slotDrafts[order.id] ??
                (preferred.length <= 1 ? order.preferredStart : "");
              const selectedSlot =
                preferred.find((slot) => slot.start === selectedStart) ??
                (preferred.length <= 1
                  ? preferred[0]
                  : {
                      start: order.preferredStart,
                      end: order.preferredEnd,
                      label: formatSlot(order.preferredStart),
                    });
              const blockers = confirmBlockers(order, selectedStart || null);
              const nextStatuses = allowedManualStatuses(order.status);
              const primarySlot =
                preferred.find((slot) => slot.start === order.preferredStart)?.label ??
                preferred[0]?.label ??
                formatSlot(order.preferredStart);

              const badges = mediaBadges(gallery);
              const coverUrl =
                gallery?.coverAssetId
                  ? `/api/g/${gallery.publicToken}/media/${gallery.coverAssetId}?v=web`
                  : null;

              return (
                <article
                  key={order.id}
                  className={`admin-order-card${expanded ? " is-expanded" : " is-collapsed"}`}
                >
                  <div className="order-card-cover">
                    {coverUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={coverUrl}
                        alt={`Cover photo for ${order.propertyAddress}`}
                        width={gallery?.coverWidth ?? undefined}
                        height={gallery?.coverHeight ?? undefined}
                        loading="lazy"
                      />
                    ) : (
                      <div className="order-card-cover-empty">
                        {gallery ? "Processing" : "No photos yet"}
                      </div>
                    )}
                    <span className={`order-chip order-chip--${order.status}`}>
                      {orderStatusLabel(order.status)}
                    </span>
                  </div>

                  <div className="admin-order-summary">
                    <button
                      type="button"
                      className="admin-order-summary-toggle"
                      aria-expanded={expanded}
                      onClick={() => toggleExpanded(order.id)}
                    >
                      <span className="admin-order-chevron" aria-hidden>
                        {expanded ? "▾" : "▸"}
                      </span>
                      <span className="admin-order-summary-copy">
                        <strong>{order.propertyAddress}</strong>
                        <span className="muted">
                          {order.agentName} · {order.packageName} ·{" "}
                          {formatMoney(order.priceCents, order.currency)}
                        </span>
                        <span className="muted">{primarySlot}</span>
                        <span className="order-media-badges">
                          {badges.map((badge) => (
                            <span key={badge}>{badge}</span>
                          ))}
                        </span>
                      </span>
                    </button>
                    <label className="admin-status-label admin-status-label--inline">
                      <span className="visually-hidden">Status</span>
                      {nextStatuses.length === 0 || order.status === "requested" ? (
                        <span
                          className="status-select status-select--locked"
                          title={
                            order.status === "requested"
                              ? "Confirm from the review checklist below"
                              : "Set by Publish or Unlock — not editable here"
                          }
                        >
                          {orderStatusLabel(order.status)}
                        </span>
                      ) : (
                        <select
                          className="status-select"
                          value={order.status}
                          disabled={orderLocked}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => {
                            const next = event.target.value as OrderStatus;
                            if (!isManualOrderStatus(next)) return;
                            if (next === order.status) return;
                            void setStatus(order.id, next);
                          }}
                        >
                          <option value={order.status}>
                            {orderStatusLabel(order.status)}
                          </option>
                          {nextStatuses.map((status) => (
                            <option key={status} value={status}>
                              {orderStatusLabel(status)}
                            </option>
                          ))}
                        </select>
                      )}
                    </label>
                  </div>

                  {expanded ? (
                    <>
                  {order.status === "requested" ? (
                    <div className="confirm-checklist">
                      <p className="eyebrow">Before you confirm</p>
                      <ul>
                        <li className={order.propertyAddress && order.postalCode && order.city ? "is-ready" : undefined}>
                          Address{order.city ? ` · ${order.city}` : " — add city"}
                        </li>
                        <li className={selectedStart ? "is-ready" : undefined}>
                          Time{selectedStart && selectedSlot ? ` · ${selectedSlot.label}` : " — pick a preferred time"}
                        </li>
                        <li className={order.priceCents > 0 ? "is-ready" : undefined}>
                          Price{order.priceCents > 0 ? ` · ${formatMoney(order.priceCents, order.currency)}` : " — set a price"}
                        </li>
                      </ul>
                      {preferred.length > 0 ? (
                        <OrderSlotPicker
                          orderId={order.id}
                          preferred={preferred}
                          selectedStart={selectedStart}
                          legend="Pick a preferred time"
                          onSelect={(start) =>
                            setSlotDrafts((current) => ({
                              ...current,
                              [order.id]: start,
                            }))
                          }
                        />
                      ) : (
                        <p>{formatSlot(order.preferredStart)}</p>
                      )}
                      {blockers.length > 0 ? (
                        <p className="muted">{blockers[0]}</p>
                      ) : null}
                      <div className="listing-index-actions">
                        <button
                          type="button"
                          className={`btn btn-solid${pending("confirm") ? " is-busy" : ""}`}
                          disabled={orderLocked || blockers.length > 0}
                          onClick={() => {
                            const slot =
                              preferred.find((item) => item.start === selectedStart) ??
                              preferred[0];
                            void setStatus(order.id, "confirmed", slot
                              ? {
                                  preferredStart: slot.start,
                                  preferredEnd: slot.end,
                                }
                              : undefined);
                          }}
                        >
                          {pending("confirm") ? "Confirming…" : "Confirm shoot"}
                        </button>
                        <button
                          type="button"
                          className={`btn btn-outline${pending("cancel") ? " is-busy" : ""}`}
                          disabled={orderLocked}
                          onClick={() => void setStatus(order.id, "cancelled")}
                        >
                          {pending("cancel") ? "Cancelling…" : "Cancel request"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="admin-order-grid">
                    <div>
                      <p className="eyebrow">Preferred times</p>
                      {preferred.length === 0 ? (
                        <div>{formatSlot(order.preferredStart)}</div>
                      ) : order.status === "requested" ? (
                        preferred.map((slot, index) => (
                          <div
                            key={slot.start}
                            className={
                              selectedStart === slot.start ? "is-booked-slot" : undefined
                            }
                          >
                            {slotOrdinal(index)}: {slot.label}
                            {selectedStart === slot.start ? " · selected" : ""}
                          </div>
                        ))
                      ) : (
                        preferred.map((slot, index) => (
                          <div
                            key={slot.start}
                            className={
                              slot.start === order.preferredStart
                                ? "is-booked-slot"
                                : undefined
                            }
                          >
                            {slotOrdinal(index)}: {slot.label}
                            {slot.start === order.preferredStart ? " · booked" : ""}
                          </div>
                        ))
                      )}
                    </div>
                    <div>
                      <p className="eyebrow">Property</p>
                      {(() => {
                        const draft = addressDraft(order);
                        return (
                          <div className="admin-address-edit">
                            <label className="field">
                              <span>Address</span>
                              <AddressAutocomplete
                                value={draft.propertyAddress}
                                onChange={(value) =>
                                  patchAddressDraft(order.id, order, {
                                    propertyAddress: value,
                                  })
                                }
                                onResolved={(address) =>
                                  patchAddressDraft(order.id, order, {
                                    propertyAddress:
                                      address.line1 || address.formatted,
                                    city: address.city || draft.city,
                                    postalCode:
                                      address.postalCode || draft.postalCode,
                                    placeId: address.placeId,
                                    mapLat: address.lat,
                                    mapLng: address.lng,
                                  })
                                }
                              />
                            </label>
                            <div className="form-grid">
                              <label className="field">
                                <span>Postal / ZIP</span>
                                <input
                                  value={draft.postalCode}
                                  onChange={(event) =>
                                    patchAddressDraft(order.id, order, {
                                      postalCode: event.target.value,
                                    })
                                  }
                                />
                              </label>
                              <label className="field">
                                <span>City</span>
                                <input
                                  value={draft.city}
                                  onChange={(event) =>
                                    patchAddressDraft(order.id, order, {
                                      city: event.target.value,
                                    })
                                  }
                                />
                              </label>
                            </div>
                            <button
                              type="button"
                              className={`btn btn-outline${pending("saveAddress") ? " is-busy" : ""}`}
                              disabled={orderLocked}
                              onClick={() => void saveAddress(order.id)}
                            >
                              {pending("saveAddress")
                                ? "Saving…"
                                : order.status === "requested"
                                  ? "Confirm address"
                                  : "Save address"}
                            </button>
                            <div className="admin-order-meta">
                              <div>
                                <strong>Occupancy</strong> {order.occupancy}
                              </div>
                              <div>
                                <strong>Access</strong> {order.accessType}
                              </div>
                              {order.accessNotes ? (
                                <div>
                                  <strong>Access notes</strong> {order.accessNotes}
                                </div>
                              ) : null}
                              {order.meetingContact ? (
                                <div>
                                  <strong>Meeting contact</strong>{" "}
                                  {order.meetingContact}
                                </div>
                              ) : null}
                              {order.pets ? (
                                <div>
                                  <strong>Pets</strong> {order.pets}
                                </div>
                              ) : null}
                              {order.parkingNotes ? (
                                <div>
                                  <strong>Parking</strong> {order.parkingNotes}
                                </div>
                              ) : null}
                              {order.notes ? (
                                <div>
                                  <strong>Notes</strong> {order.notes}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <div>
                      <p className="eyebrow">Agent</p>
                      <div>{order.agentName}</div>
                      <div className="muted">
                        <a href={`mailto:${order.agentEmail}`}>{order.agentEmail}</a>
                      </div>
                      {order.agentPhone ? (
                        <div className="muted">
                          <a href={`tel:${order.agentPhone}`}>{order.agentPhone}</a>
                        </div>
                      ) : null}
                      {order.brokerage ? (
                        <div className="muted">{order.brokerage}</div>
                      ) : null}
                    </div>
                    <div>
                      <p className="eyebrow">Package</p>
                      <div>{order.packageName}</div>
                      <div className="muted">
                        {formatMoney(order.priceCents, order.currency)} ·{" "}
                        {order.squareFootage} sq ft · {order.durationMinutes} min
                      </div>
                      {order.priceCents <= 0 || order.status === "requested" ? (
                        <div className="admin-quote-price">
                          <label className="field">
                            <span>
                              {order.priceCents <= 0
                                ? "Set price (dollars)"
                                : "Confirm price (dollars)"}
                            </span>
                            <input
                              type="number"
                              min={1}
                              step="1"
                              value={
                                priceDrafts[order.id] ??
                                (order.priceCents > 0
                                  ? String(Math.round(order.priceCents / 100))
                                  : "")
                              }
                              onChange={(event) =>
                                setPriceDrafts((current) => ({
                                  ...current,
                                  [order.id]: event.target.value,
                                }))
                              }
                              placeholder="e.g. 200"
                            />
                          </label>
                          <button
                            type="button"
                            className={`btn btn-outline${pending("savePrice") ? " is-busy" : ""}`}
                            disabled={orderLocked}
                            onClick={() => void savePrice(order.id)}
                          >
                            {pending("savePrice") ? "Saving…" : "Save price"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="admin-delivery">
                    <div className="delivery-flow-head">
                      <div>
                        <p className="eyebrow">Delivery</p>
                        <strong>Get photos to the agent and get paid</strong>
                      </div>
                    </div>

                    <ol className="delivery-steps" aria-label="Delivery steps">
                      <li
                        className={`delivery-step${phase === 1 ? " is-current" : ""}${phase > 1 ? " is-done" : ""}`}
                      >
                        <span className="delivery-step-num">1</span>
                        <div className="delivery-step-body">
                          <div className="delivery-step-title">Upload photos</div>
                          <p className="muted">
                            {gallery?.mediaCount
                              ? `${gallery.mediaCount} photo${gallery.mediaCount === 1 ? "" : "s"} on this shoot. Preview before you email the agent.`
                              : "Add edited JPEGs from this shoot."}
                          </p>
                          <div className="delivery-step-actions">
                            <label className="delivery-file">
                              <span className="btn btn-outline">
                                {fileNames[order.id] || "Choose files"}
                              </span>
                              <input
                                ref={(node) => {
                                  fileRefs.current[order.id] = node;
                                }}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/heic,.jpg,.jpeg,.png,.webp"
                                multiple
                                onChange={(event) => {
                                  const count = event.target.files?.length ?? 0;
                                  setFileNames((current) => ({
                                    ...current,
                                    [order.id]:
                                      count === 0
                                        ? ""
                                        : count === 1
                                          ? event.target.files![0]!.name
                                          : `${count} files selected`,
                                  }));
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              className={`btn btn-solid${pending("upload") ? " is-busy" : ""}`}
                              disabled={orderLocked}
                              onClick={() => uploadPhotos(order.id)}
                            >
                              {pending("upload") ? "Uploading…" : "Upload"}
                            </button>
                            {gallery && gallery.mediaCount > 0 && branded ? (
                              <a
                                className="btn btn-outline"
                                href={branded}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Preview gallery
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </li>

                      <li
                        className={`delivery-step${phase === 2 ? " is-current" : ""}${phase > 2 ? " is-done" : ""}`}
                      >
                        <span className="delivery-step-num">2</span>
                        <div className="delivery-step-body">
                          <div className="delivery-step-title">Publish to agent</div>
                          <p className="muted">
                            Emails {order.agentName} the gallery link. They can
                            preview, then pay to download. Use Preview in step 1
                            first if you want to check the set.
                          </p>
                          <div className="delivery-step-actions">
                            {gallery && gallery.mediaCount > 0 && branded ? (
                              <a
                                className="btn btn-outline"
                                href={branded}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Preview gallery
                              </a>
                            ) : null}
                            <button
                              type="button"
                              className={`btn btn-solid${pending("publish") ? " is-busy" : ""}`}
                              disabled={
                                orderLocked || !gallery || gallery.mediaCount === 0
                              }
                              onClick={() => publish(order.id)}
                            >
                              {pending("publish")
                                ? "Publishing…"
                                : published
                                  ? "Publish again"
                                  : "Publish & email agent"}
                            </button>
                          </div>
                        </div>
                      </li>

                      <li
                        className={`delivery-step${phase === 3 ? " is-current" : ""}${phase > 3 ? " is-done" : ""}`}
                      >
                        <span className="delivery-step-num">3</span>
                        <div className="delivery-step-body">
                          <div className="delivery-step-title">
                            Agent opens gallery & pays
                          </div>
                          <p className="muted">
                            {paid
                              ? "Payment received — downloads are unlocked."
                              : published
                                ? "Send or resend this link anytime. Checkout unlocks full-res + MLS files."
                                : gallery?.mediaCount
                                  ? "Link works for your preview now. The agent is only emailed after you publish."
                                  : "Available after you upload."}
                          </p>
                          {gallery ? (
                            <div className="delivery-agent-link">
                              <code>{branded}</code>
                              <div className="delivery-step-actions">
                                <button
                                  type="button"
                                  className="btn btn-outline"
                                  onClick={() =>
                                    void copyText(`${order.id}-branded`, branded!)
                                  }
                                >
                                  {copiedKey === `${order.id}-branded`
                                    ? "Copied"
                                    : "Copy link"}
                                </button>
                                <a
                                  className="btn btn-outline"
                                  href={branded!}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Open gallery
                                </a>
                                <a
                                  className="btn btn-outline"
                                  href={`mailto:${order.agentEmail}?subject=${encodeURIComponent(`Your photos — ${order.propertyAddress}`)}&body=${encodeURIComponent(`Hi ${order.agentName},\n\nYour gallery is ready:\n${branded}\n\nPreview the photos, then pay to unlock downloads.\n\n— ${order.packageName}`)}`}
                                >
                                  Open mail app
                                </a>
                              </div>
                              {unbranded ? (
                                <p className="muted delivery-mls-hint">
                                  MLS / unbranded:{" "}
                                  <button
                                    type="button"
                                    className="text-link"
                                    onClick={() =>
                                      void copyText(
                                        `${order.id}-unbranded`,
                                        unbranded,
                                      )
                                    }
                                  >
                                    {copiedKey === `${order.id}-unbranded`
                                      ? "Copied"
                                      : "copy"}
                                  </button>
                                </p>
                              ) : null}
                              {orderLinks?.listing ? (
                                <p className="muted delivery-mls-hint">
                                  Property page:{" "}
                                  <button
                                    type="button"
                                    className="text-link"
                                    onClick={() =>
                                      void copyText(
                                        `${order.id}-listing`,
                                        orderLinks.listing!,
                                      )
                                    }
                                  >
                                    {copiedKey === `${order.id}-listing`
                                      ? "Copied"
                                      : "copy"}
                                  </button>
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <p className="muted">Upload photos first to create a gallery.</p>
                          )}
                        </div>
                      </li>

                      <li
                        className={`delivery-step${phase === 4 ? " is-current" : ""}${paid ? " is-done" : ""}`}
                      >
                        <span className="delivery-step-num">4</span>
                        <div className="delivery-step-body">
                          <div className="delivery-step-title">Unlock downloads</div>
                          <p className="muted">
                            {paid
                              ? "Gallery is unlocked. Agent can download full-resolution files."
                              : "Normally unlocks automatically after Stripe Checkout. Use this if they paid e-transfer or outside the app."}
                          </p>
                          <div className="delivery-step-actions">
                            <button
                              type="button"
                              className={`btn btn-outline${pending("unlock") ? " is-busy" : ""}`}
                              disabled={orderLocked || !gallery || paid}
                              onClick={() => forceUnlock(order.id)}
                            >
                              {pending("unlock")
                                ? "Unlocking…"
                                : paid
                                  ? "Already unlocked"
                                  : "Mark paid & unlock"}
                            </button>
                          </div>
                        </div>
                      </li>
                    </ol>

                    <details className="delivery-extras">
                      <summary>Video, tours & floor plans</summary>
                      <OrderMediaLinks orderId={order.id} />
                    </details>

                    <details className="delivery-extras">
                      <summary>Share kit & reports</summary>
                      <div className="admin-delivery-actions">
                        <a
                          className="btn btn-outline"
                          href={`/api/admin/orders/${order.id}/share`}
                        >
                          Share copy
                        </a>
                        <a
                          className="btn btn-outline"
                          href={`/api/admin/orders/${order.id}/share?flyer=1`}
                        >
                          Flyer PDF
                        </a>
                        <a
                          className="btn btn-outline"
                          href={`/api/admin/orders/${order.id}/share?preset=ig`}
                        >
                          IG crop
                        </a>
                        <a
                          className="btn btn-outline"
                          href={`/api/admin/orders/${order.id}/report`}
                        >
                          Report
                        </a>
                        {gallery ? (
                          <a
                            className="text-link"
                            href={`/g/${gallery.publicToken}/report`}
                          >
                            Agent report
                          </a>
                        ) : null}
                      </div>
                    </details>
                  </div>
                    </>
                  ) : null}
                </article>
              );
            })}
          </div>
          {visibleOrders.length === 0 ? (
            <p className="muted">No orders with that status.</p>
          ) : null}
        </>
      )}
    </div>
  );
}
