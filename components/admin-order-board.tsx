"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Gallery, Order, OrderStatus } from "@/lib/db/schema";
import { ORDER_STATUSES } from "@/lib/db/schema";
import { parsePreferredSlotsJson } from "@/lib/preferred-slots";

function formatMoney(cents: number, currency: string) {
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

type GallerySummary = Pick<
  Gallery,
  "id" | "orderId" | "state" | "publicToken" | "trustTier" | "brandMode"
> & { mediaCount: number };

export function AdminOrderBoard({
  initialOrders,
  initialGalleries,
}: {
  initialOrders: Order[];
  initialGalleries: GallerySummary[];
}) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [galleries, setGalleries] = useState(initialGalleries);
  const [error, setError] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [links, setLinks] = useState<
    Record<string, { branded: string; unbranded: string; listing?: string }>
  >({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function galleryFor(orderId: string) {
    return galleries.find((gallery) => gallery.orderId === orderId) ?? null;
  }

  async function setStatus(orderId: string, status: OrderStatus) {
    setError(null);
    const response = await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await response.json();
    if (!json.ok) {
      setError(json.error ?? "Could not update status.");
      return;
    }
    setOrders((current) =>
      current.map((order) => (order.id === orderId ? json.order : order)),
    );
  }

  async function uploadPhotos(orderId: string) {
    const input = fileRefs.current[orderId];
    if (!input?.files?.length) {
      setError("Choose one or more photos to upload.");
      return;
    }

    setBusyOrderId(orderId);
    setError(null);
    const form = new FormData();
    Array.from(input.files).forEach((file) => form.append("files", file));

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/upload`, {
        method: "POST",
        body: form,
      });
      const json = await response.json();
      if (!json.ok) {
        setError(json.error ?? "Upload failed.");
        return;
      }

      setGalleries((current) => {
        const without = current.filter((gallery) => gallery.orderId !== orderId);
        return [
          ...without,
          {
            id: json.galleryId,
            orderId,
            state: json.state,
            publicToken: json.token,
            trustTier:
              galleryFor(orderId)?.trustTier ??
              ("pay_first" as const),
            brandMode: galleryFor(orderId)?.brandMode ?? ("branded" as const),
            mediaCount: (galleryFor(orderId)?.mediaCount ?? 0) + json.uploaded,
          },
        ];
      });
      input.value = "";
      router.refresh();
    } finally {
      setBusyOrderId(null);
    }
  }

  async function publish(orderId: string) {
    setBusyOrderId(orderId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      });
      const json = await response.json();
      if (!json.ok) {
        setError(json.error ?? "Could not publish.");
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
    } finally {
      setBusyOrderId(null);
    }
  }

  async function forceUnlock(orderId: string) {
    setBusyOrderId(orderId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlock", markPaid: true }),
      });
      const json = await response.json();
      if (!json.ok) {
        setError(json.error ?? "Could not unlock.");
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
      setBusyOrderId(null);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="admin-board">
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">Orders</p>
          <h1>Shoot board</h1>
        </div>
        <button type="button" className="btn btn-outline" onClick={logout}>
          Sign out
        </button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {orders.length === 0 ? (
        <div className="booking-card">
          <p>No orders yet. When an agent books at `/book`, they show up here.</p>
        </div>
      ) : (
        <div className="admin-order-list">
          {orders.map((order) => {
            const gallery = galleryFor(order.id);
            const orderLinks = links[order.id];
            const busy = busyOrderId === order.id;
            return (
              <article key={order.id} className="admin-order-card">
                <div className="admin-order-grid">
                  <div>
                    <p className="eyebrow">Preferred times</p>
                    {(() => {
                      const preferred = parsePreferredSlotsJson(
                        order.preferredSlotsJson,
                      );
                      if (preferred.length === 0) {
                        return <div>{formatSlot(order.preferredStart)}</div>;
                      }
                      return preferred.map((slot, index) => (
                        <div key={slot.start}>
                          {index === 0 ? "1st" : index === 1 ? "2nd" : "3rd"}:{" "}
                          {slot.label}
                        </div>
                      ));
                    })()}
                    <div className="muted">{order.id}</div>
                  </div>
                  <div>
                    <p className="eyebrow">Property</p>
                    <div>{order.propertyAddress}</div>
                    <div className="muted">
                      {order.postalCode}
                      {order.city ? ` · ${order.city}` : ""}
                    </div>
                    <div className="muted">
                      {order.occupancy} · {order.accessType}
                      {order.accessNotes ? ` · ${order.accessNotes}` : ""}
                    </div>
                  </div>
                  <div>
                    <p className="eyebrow">Agent</p>
                    <div>{order.agentName}</div>
                    <div className="muted">
                      <a href={`mailto:${order.agentEmail}`}>{order.agentEmail}</a>
                    </div>
                    {order.agentPhone ? (
                      <div className="muted">{order.agentPhone}</div>
                    ) : null}
                  </div>
                  <div>
                    <p className="eyebrow">Package</p>
                    <div>{order.packageName}</div>
                    <div className="muted">
                      {formatMoney(order.priceCents, order.currency)} ·{" "}
                      {order.squareFootage} sq ft · {order.durationMinutes} min
                    </div>
                    <label className="admin-status-label">
                      Status
                      <select
                        className="status-select"
                        value={order.status}
                        onChange={(event) =>
                          setStatus(order.id, event.target.value as OrderStatus)
                        }
                      >
                        {ORDER_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="admin-delivery">
                  <div className="admin-delivery-head">
                    <div>
                      <p className="eyebrow">Delivery</p>
                      <strong>
                        {gallery
                          ? `${gallery.mediaCount} photo${gallery.mediaCount === 1 ? "" : "s"} · ${gallery.state} · ${gallery.trustTier}`
                          : "No gallery yet"}
                      </strong>
                    </div>
                    {gallery ? (
                      <a
                        className="text-link"
                        href={`/g/${gallery.publicToken}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open gallery
                      </a>
                    ) : null}
                  </div>

                  <div className="admin-delivery-actions">
                    <input
                      ref={(node) => {
                        fileRefs.current[order.id] = node;
                      }}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,.jpg,.jpeg,.png,.webp"
                      multiple
                    />
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={busy}
                      onClick={() => uploadPhotos(order.id)}
                    >
                      {busy ? "Working…" : "Upload photos"}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={busy || !gallery || gallery.mediaCount === 0}
                      onClick={() => publish(order.id)}
                    >
                      Publish to agent
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={busy || !gallery || gallery.state === "unlocked"}
                      onClick={() => forceUnlock(order.id)}
                    >
                      Unlock (mark paid)
                    </button>
                  </div>

                  {orderLinks ? (
                    <div className="admin-share-links">
                      <div>
                        <span className="muted">Branded</span>
                        <code>{orderLinks.branded}</code>
                      </div>
                      <div>
                        <span className="muted">Unbranded / MLS</span>
                        <code>{orderLinks.unbranded}</code>
                      </div>
                      {orderLinks.listing ? (
                        <div>
                          <span className="muted">Property page</span>
                          <code>{orderLinks.listing}</code>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="admin-delivery-actions">
                    <a className="btn btn-outline" href={`/api/admin/orders/${order.id}/share`}>
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
                    <a className="btn btn-outline" href={`/api/admin/orders/${order.id}/report`}>
                      Report
                    </a>
                    {gallery ? (
                      <a className="text-link" href={`/g/${gallery.publicToken}/report`}>
                        Agent report
                      </a>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
