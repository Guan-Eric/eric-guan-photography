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

type OrderPhoto = {
  id: string;
  originalName: string;
  roomLabel: string | null;
};

type PendingShot = {
  key: string;
  file: File;
  preview: string;
};

type UploadProgress = {
  current: number;
  total: number;
  percent: number;
  label: string;
};

function postPhotoUpload(
  orderId: string,
  file: File,
  onProgress: (loaded: number, total: number, phase: "send" | "process") => void,
  signal?: AbortSignal,
): Promise<{
  ok?: boolean;
  error?: string;
  galleryId?: string;
  state?: GallerySummary["state"];
  token?: string;
  uploaded?: number;
}> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/admin/orders/${orderId}/upload`);
    xhr.timeout = 90_000;
    const form = new FormData();
    form.append("files", file);
    const abort = () => {
      xhr.abort();
      reject(new Error("Upload cancelled."));
    };
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total, "send");
    };
    xhr.upload.onload = () => onProgress(1, 1, "process");
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.ontimeout = () =>
      reject(new Error("Upload timed out. Try a smaller JPEG."));
    xhr.onload = () => {
      let json: Awaited<ReturnType<typeof postPhotoUpload>> | null = null;
      try {
        json = JSON.parse(xhr.responseText) as Awaited<
          ReturnType<typeof postPhotoUpload>
        >;
      } catch {
        json = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && json) {
        resolve(json);
        return;
      }
      reject(new Error(json?.error ?? `Upload failed (${xhr.status}).`));
    };
    xhr.send(form);
  });
}

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

function moveItem<T>(list: T[], from: number, to: number) {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

function factLabel(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(/[_-]/g, " ");
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
  lifetimeOfferOpen = false,
  lifetimePriceUsd = 199,
}: {
  initialOrders: Order[];
  initialGalleries: GallerySummary[];
  bookingUrl: string;
  siteUrl: string;
  welcome?: boolean;
  plan?: string | null;
  lifetimeOfferOpen?: boolean;
  lifetimePriceUsd?: number;
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
  const [pendingShots, setPendingShots] = useState<Record<string, PendingShot[]>>(
    {},
  );
  const [orderPhotos, setOrderPhotos] = useState<Record<string, OrderPhoto[]>>(
    {},
  );
  const [uploadProgress, setUploadProgress] = useState<
    Record<string, UploadProgress | null>
  >({});
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
  const uploadAbortRef = useRef<AbortController | null>(null);
  const dragPhotoRef = useRef<{ orderId: string; id: string } | null>(null);

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
      else {
        next.add(orderId);
        void loadOrderPhotos(orderId);
      }
      return next;
    });
  }

  async function loadOrderPhotos(orderId: string) {
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/photos`);
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        photos?: OrderPhoto[];
      } | null;
      if (!response.ok || !json?.ok) return;
      setOrderPhotos((current) => ({
        ...current,
        [orderId]: json.photos ?? [],
      }));
    } catch {
      /* keep last known grid */
    }
  }

  function expandAllVisible() {
    setExpandedIds((current) => {
      const next = new Set(current);
      for (const order of visibleOrders) {
        next.add(order.id);
        void loadOrderPhotos(order.id);
      }
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
    const queued = pendingShots[orderId] ?? [];
    if (queued.length === 0) {
      fail("Choose one or more photos to upload.");
      return;
    }

    setBusy({ orderId, action: "upload" });
    setError(null);
    const total = queued.length;
    let uploadedCount = 0;
    const controller = new AbortController();
    uploadAbortRef.current = controller;

    try {
      for (let index = 0; index < queued.length; index += 1) {
        const shot = queued[index]!;
        setUploadProgress((current) => ({
          ...current,
          [orderId]: {
            current: index + 1,
            total,
            percent: Math.round((index / total) * 100),
            label: `Uploading ${index + 1} of ${total}: ${shot.file.name}`,
          },
        }));

        const json = await postPhotoUpload(
          orderId,
          shot.file,
          (loaded, totalBytes, phase) => {
          const fileFraction =
            phase === "process" ? 1 : totalBytes > 0 ? loaded / totalBytes : 0;
          const overall = ((index + fileFraction * 0.92) / total) * 100;
          setUploadProgress((current) => ({
            ...current,
            [orderId]: {
              current: index + 1,
              total,
              percent: Math.min(99, Math.round(overall)),
              label:
                phase === "process"
                  ? `Processing ${shot.file.name}…`
                  : `Uploading ${index + 1} of ${total}: ${shot.file.name}`,
            },
          }));
        },
          controller.signal,
        );

        if (!json.ok) {
          throw new Error(json.error ?? "Upload failed.");
        }
        uploadedCount += json.uploaded ?? 1;

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
              mediaCount: (previous?.mediaCount ?? 0) + (json.uploaded ?? 1),
              coverAssetId: previous?.coverAssetId ?? null,
              coverWidth: previous?.coverWidth ?? null,
              coverHeight: previous?.coverHeight ?? null,
              videoCount: previous?.videoCount ?? 0,
              tourCount: previous?.tourCount ?? 0,
              floorPlanCount: previous?.floorPlanCount ?? 0,
            },
          ];
        });

        URL.revokeObjectURL(shot.preview);
        setPendingShots((current) => ({
          ...current,
          [orderId]: (current[orderId] ?? []).filter((item) => item.key !== shot.key),
        }));
        await loadOrderPhotos(orderId);
      }

      const input = fileRefs.current[orderId];
      if (input) input.value = "";
      setFileNames((current) => ({ ...current, [orderId]: "" }));
      setUploadProgress((current) => ({ ...current, [orderId]: null }));
      ok(
        `Uploaded ${uploadedCount} photo${uploadedCount === 1 ? "" : "s"}.`,
      );
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Network error during upload.";
      fail(message);
    } finally {
      uploadAbortRef.current = null;
      setBusy(null);
      setUploadProgress((current) => ({ ...current, [orderId]: null }));
    }
  }

  function queuePhotos(orderId: string, list: FileList | null) {
    const files = list ? Array.from(list) : [];
    if (files.length === 0) return;
    const added = files.map((file) => ({
      key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
    }));
    setPendingShots((current) => {
      const next = [...(current[orderId] ?? []), ...added];
      return { ...current, [orderId]: next };
    });
    setFileNames((names) => {
      const count = (pendingShots[orderId]?.length ?? 0) + added.length;
      return {
        ...names,
        [orderId]:
          count === 1 ? added[0]!.file.name : `${count} files selected`,
      };
    });
  }

  function removeQueuedPhoto(orderId: string, key: string) {
    setPendingShots((current) => {
      const existing = current[orderId] ?? [];
      const target = existing.find((item) => item.key === key);
      if (target) URL.revokeObjectURL(target.preview);
      const next = existing.filter((item) => item.key !== key);
      setFileNames((names) => ({
        ...names,
        [orderId]:
          next.length === 0
            ? ""
            : next.length === 1
              ? next[0]!.file.name
              : `${next.length} files selected`,
      }));
      return { ...current, [orderId]: next };
    });
  }

  async function removeUploadedPhoto(orderId: string, assetId: string) {
    if (!window.confirm("Remove this photo from the gallery?")) return;
    try {
      const response = await fetch(
        `/api/admin/orders/${orderId}/photos/${assetId}`,
        { method: "DELETE" },
      );
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!response.ok || !json?.ok) {
        fail(json?.error ?? "Could not remove photo.");
        return;
      }
      setOrderPhotos((current) => ({
        ...current,
        [orderId]: (current[orderId] ?? []).filter((photo) => photo.id !== assetId),
      }));
      setGalleries((current) =>
        current.map((gallery) =>
          gallery.orderId === orderId
            ? {
                ...gallery,
                mediaCount: Math.max(0, gallery.mediaCount - 1),
              }
            : gallery,
        ),
      );
      ok("Photo removed.");
    } catch {
      fail("Network error removing photo.");
    }
  }

  async function savePhotoOrder(orderId: string, next: OrderPhoto[]) {
    const previous = orderPhotos[orderId] ?? [];
    setOrderPhotos((current) => ({ ...current, [orderId]: next }));
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/photos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: next.map((photo) => photo.id) }),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!response.ok || !json?.ok) {
        setOrderPhotos((current) => ({ ...current, [orderId]: previous }));
        fail(json?.error ?? "Could not save photo order.");
      }
    } catch {
      setOrderPhotos((current) => ({ ...current, [orderId]: previous }));
      fail("Network error saving photo order.");
    }
  }

  function moveUploadedPhoto(orderId: string, assetId: string, direction: -1 | 1) {
    const list = orderPhotos[orderId] ?? [];
    const from = list.findIndex((photo) => photo.id === assetId);
    if (from < 0) return;
    const next = moveItem(list, from, from + direction);
    if (next === list) return;
    void savePhotoOrder(orderId, next);
  }

  function dropUploadedPhoto(orderId: string, targetId: string) {
    const dragged = dragPhotoRef.current;
    if (!dragged || dragged.orderId !== orderId || dragged.id === targetId) return;
    const list = orderPhotos[orderId] ?? [];
    const from = list.findIndex((photo) => photo.id === dragged.id);
    const to = list.findIndex((photo) => photo.id === targetId);
    if (from < 0 || to < 0) return;
    const next = moveItem(list, from, to);
    dragPhotoRef.current = null;
    void savePhotoOrder(orderId, next);
  }

  function moveQueuedPhoto(orderId: string, key: string, direction: -1 | 1) {
    setPendingShots((current) => {
      const list = current[orderId] ?? [];
      const from = list.findIndex((shot) => shot.key === key);
      if (from < 0) return current;
      return { ...current, [orderId]: moveItem(list, from, from + direction) };
    });
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
        lifetimeOfferOpen={lifetimeOfferOpen}
        lifetimePriceUsd={lifetimePriceUsd}
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
                    <section className="order-fact-card order-fact-card--times">
                      <p className="eyebrow">Preferred times</p>
                      {preferred.length === 0 ? (
                        <p className="order-fact-value">
                          {formatSlot(order.preferredStart)}
                        </p>
                      ) : (
                        <ol className="order-slot-chips">
                          {preferred.map((slot, index) => {
                            const booked =
                              order.status === "requested"
                                ? selectedStart === slot.start
                                : slot.start === order.preferredStart;
                            return (
                              <li
                                key={slot.start}
                                className={booked ? "is-booked" : undefined}
                              >
                                <span className="order-slot-rank">
                                  {slotOrdinal(index)}
                                </span>
                                <span className="order-slot-copy">{slot.label}</span>
                                {booked ? (
                                  <span className="order-slot-flag">
                                    {order.status === "requested" ? "Selected" : "Booked"}
                                  </span>
                                ) : null}
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </section>
                    <section className="order-fact-card order-fact-card--property">
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
                            <div className="order-fact-pills">
                              <span className="order-pill">
                                {factLabel(order.occupancy) || "Occupancy —"}
                              </span>
                              <span className="order-pill">
                                {factLabel(order.accessType) || "Access —"}
                              </span>
                            </div>
                            {order.accessNotes ? (
                              <p className="order-fact-note">
                                <strong>Access notes</strong> {order.accessNotes}
                              </p>
                            ) : null}
                            {order.meetingContact ? (
                              <p className="order-fact-note">
                                <strong>Meeting</strong> {order.meetingContact}
                              </p>
                            ) : null}
                            {order.pets ? (
                              <p className="order-fact-note">
                                <strong>Pets</strong> {order.pets}
                              </p>
                            ) : null}
                            {order.parkingNotes ? (
                              <p className="order-fact-note">
                                <strong>Parking</strong> {order.parkingNotes}
                              </p>
                            ) : null}
                            {order.notes ? (
                              <p className="order-fact-note">
                                <strong>Notes</strong> {order.notes}
                              </p>
                            ) : null}
                          </div>
                        );
                      })()}
                    </section>
                    <section className="order-fact-card order-fact-card--agent">
                      <p className="eyebrow">Agent</p>
                      <p className="order-fact-value">{order.agentName}</p>
                      <p className="order-fact-note">
                        <a href={`mailto:${order.agentEmail}`}>{order.agentEmail}</a>
                      </p>
                      {order.agentPhone ? (
                        <p className="order-fact-note">
                          <a href={`tel:${order.agentPhone}`}>{order.agentPhone}</a>
                        </p>
                      ) : null}
                      {order.brokerage ? (
                        <p className="order-fact-note">{order.brokerage}</p>
                      ) : null}
                    </section>
                    <section className="order-fact-card order-fact-card--package">
                      <p className="eyebrow">Package</p>
                      <p className="order-fact-value">{order.packageName}</p>
                      <p className="order-fact-note">
                        {formatMoney(order.priceCents, order.currency)} ·{" "}
                        {order.squareFootage} sq ft · {order.durationMinutes} min
                      </p>
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
                    </section>
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
                              ? `${gallery.mediaCount} photo${gallery.mediaCount === 1 ? "" : "s"} on this shoot. Drag to reorder the gallery, or add more files below.`
                              : "Add edited JPEGs from this shoot."}
                          </p>
                          <div className="delivery-photo-panel is-gallery">
                            <div className="delivery-photo-panel-head">
                              <strong>On this gallery</strong>
                              <span>
                                {orderPhotos[order.id]?.length ?? 0} uploaded
                              </span>
                            </div>
                            {(orderPhotos[order.id] ?? []).length > 0 ? (
                              <ul className="delivery-photo-grid">
                                {(orderPhotos[order.id] ?? []).map((photo, index) => (
                                  <li
                                    key={photo.id}
                                    className="delivery-photo-card"
                                    draggable={!orderLocked && !pending("upload")}
                                    onDragStart={() => {
                                      dragPhotoRef.current = {
                                        orderId: order.id,
                                        id: photo.id,
                                      };
                                    }}
                                    onDragOver={(event) => event.preventDefault()}
                                    onDrop={(event) => {
                                      event.preventDefault();
                                      dropUploadedPhoto(order.id, photo.id);
                                    }}
                                  >
                                    <span className="delivery-photo-index">
                                      {index + 1}
                                    </span>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={`/api/admin/orders/${order.id}/photos/${photo.id}`}
                                      alt={photo.originalName}
                                    />
                                    <span className="delivery-photo-name">
                                      {photo.originalName}
                                    </span>
                                    <div className="delivery-photo-tools">
                                      <button
                                        type="button"
                                        className="btn btn-outline"
                                        disabled={
                                          index === 0 ||
                                          orderLocked ||
                                          pending("upload")
                                        }
                                        onClick={() =>
                                          moveUploadedPhoto(order.id, photo.id, -1)
                                        }
                                      >
                                        ←
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-outline"
                                        disabled={
                                          index ===
                                            (orderPhotos[order.id]?.length ?? 1) - 1 ||
                                          orderLocked ||
                                          pending("upload")
                                        }
                                        onClick={() =>
                                          moveUploadedPhoto(order.id, photo.id, 1)
                                        }
                                      >
                                        →
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-outline delivery-photo-remove"
                                        disabled={orderLocked || pending("upload")}
                                        onClick={() =>
                                          void removeUploadedPhoto(order.id, photo.id)
                                        }
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="delivery-photo-empty muted">
                                Nothing in the gallery yet. Choose files below, then
                                upload.
                              </p>
                            )}
                          </div>
                          <div className="delivery-photo-panel is-queue">
                            <div className="delivery-photo-panel-head">
                              <strong>Ready to upload</strong>
                              <span>
                                {pendingShots[order.id]?.length ?? 0} selected
                              </span>
                            </div>
                            {(pendingShots[order.id] ?? []).length > 0 ? (
                              <ul className="delivery-photo-grid">
                                {(pendingShots[order.id] ?? []).map((shot, index) => (
                                  <li
                                    key={shot.key}
                                    className="delivery-photo-card is-queued"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={shot.preview} alt={shot.file.name} />
                                    <span className="delivery-photo-name">
                                      {shot.file.name}
                                    </span>
                                    <div className="delivery-photo-tools">
                                      <button
                                        type="button"
                                        className="btn btn-outline"
                                        disabled={index === 0 || pending("upload")}
                                        onClick={() =>
                                          moveQueuedPhoto(order.id, shot.key, -1)
                                        }
                                      >
                                        ←
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-outline"
                                        disabled={
                                          index ===
                                            (pendingShots[order.id]?.length ?? 1) - 1 ||
                                          pending("upload")
                                        }
                                        onClick={() =>
                                          moveQueuedPhoto(order.id, shot.key, 1)
                                        }
                                      >
                                        →
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-outline delivery-photo-remove"
                                        disabled={pending("upload")}
                                        onClick={() =>
                                          removeQueuedPhoto(order.id, shot.key)
                                        }
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="delivery-photo-empty muted">
                                Choose files, then press Upload. They stay here until
                                they finish processing.
                              </p>
                            )}
                            {uploadProgress[order.id] ? (
                              <div
                                className="delivery-upload-progress"
                                role="progressbar"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={uploadProgress[order.id]!.percent}
                                aria-label={uploadProgress[order.id]!.label}
                              >
                                <div className="delivery-upload-progress-bar">
                                  <span
                                    style={{
                                      width: `${uploadProgress[order.id]!.percent}%`,
                                    }}
                                  />
                                </div>
                                <p className="muted">
                                  {uploadProgress[order.id]!.label} (
                                  {uploadProgress[order.id]!.percent}%)
                                </p>
                                {pending("upload") ? (
                                  <button
                                    type="button"
                                    className="btn btn-outline"
                                    onClick={() => uploadAbortRef.current?.abort()}
                                  >
                                    Cancel
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                            <div className="delivery-step-actions">
                              <label className="delivery-file">
                                <span className="btn btn-outline">Choose files</span>
                                <input
                                  ref={(node) => {
                                    fileRefs.current[order.id] = node;
                                  }}
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,image/heic,.jpg,.jpeg,.png,.webp"
                                  multiple
                                  onChange={(event) => {
                                    queuePhotos(order.id, event.target.files);
                                    event.target.value = "";
                                  }}
                                />
                              </label>
                              <button
                                type="button"
                                className={`btn btn-solid${pending("upload") ? " is-busy" : ""}`}
                                disabled={
                                  orderLocked ||
                                  pending("upload") ||
                                  !(pendingShots[order.id]?.length)
                                }
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
