"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Gallery, Order, OrderStatus } from "@/lib/db/schema";
import { ORDER_STATUSES, orderStatusLabel } from "@/lib/db/schema";
import { parsePreferredSlotsJson } from "@/lib/preferred-slots";
import { AdminGettingStarted } from "@/components/admin-getting-started";

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

function deliveryPhase(
  gallery: GallerySummary | null,
  orderStatus: OrderStatus,
): 1 | 2 | 3 | 4 {
  if (orderStatus === "paid" || gallery?.state === "unlocked") return 4;
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
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [links, setLinks] = useState<
    Record<string, { branded: string; unbranded: string; listing?: string }>
  >({});
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const siteBase = siteUrl.replace(/\/$/, "");

  const visibleOrders =
    statusFilter === "all"
      ? orders
      : orders.filter((order) => order.status === statusFilter);

  function galleryUrl(token: string, brand: "branded" | "unbranded" = "branded") {
    const url = new URL(`/g/${token}`, `${siteBase}/`);
    if (brand === "unbranded") url.searchParams.set("brand", "off");
    return url.toString();
  }

  async function copyText(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }

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
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        galleryId?: string;
        state?: GallerySummary["state"];
        token?: string;
        uploaded?: number;
      } | null;
      if (!response.ok || !json?.ok) {
        setError(json?.error ?? `Upload failed (${response.status}).`);
        return;
      }

      setGalleries((current) => {
        const without = current.filter((gallery) => gallery.orderId !== orderId);
        return [
          ...without,
          {
            id: json.galleryId!,
            orderId,
            state: json.state!,
            publicToken: json.token!,
            trustTier:
              galleryFor(orderId)?.trustTier ?? ("pay_first" as const),
            brandMode: galleryFor(orderId)?.brandMode ?? ("branded" as const),
            mediaCount: (galleryFor(orderId)?.mediaCount ?? 0) + (json.uploaded ?? 0),
          },
        ];
      });
      input.value = "";
      setFileNames((current) => ({ ...current, [orderId]: "" }));
      router.refresh();
    } catch {
      setError("Network error during upload.");
    } finally {
      setBusyOrderId(null);
    }
  }

  async function publish(orderId: string) {
    setBusyOrderId(orderId);
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
      if (json.emailError) {
        setError(`Gallery published, but email failed: ${json.emailError}`);
      } else if (json.emailStubbed) {
        setNotice("Gallery published. Email was logged locally (no RESEND_API_KEY).");
      } else if (json.emailSent) {
        setNotice("Gallery published and email sent to the agent.");
      } else {
        setNotice("Gallery published.");
      }
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

  return (
    <div className="admin-board">
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">Orders</p>
          <h1>Shoots</h1>
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
          </div>
          <div className="admin-order-list">
            {visibleOrders.map((order) => {
              const gallery = galleryFor(order.id);
              const orderLinks = links[order.id];
              const busy = busyOrderId === order.id;
              const phase = deliveryPhase(gallery, order.status);
              const branded =
                orderLinks?.branded ??
                (gallery ? galleryUrl(gallery.publicToken, "branded") : null);
              const unbranded =
                orderLinks?.unbranded ??
                (gallery ? galleryUrl(gallery.publicToken, "unbranded") : null);
              const published =
                order.status === "delivered" ||
                order.status === "paid" ||
                gallery?.state === "unlocked";
              const paid =
                order.status === "paid" || gallery?.state === "unlocked";

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
                              {orderStatusLabel(status)}
                            </option>
                          ))}
                        </select>
                      </label>
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
                              className="btn btn-solid"
                              disabled={busy}
                              onClick={() => uploadPhotos(order.id)}
                            >
                              {busy && phase === 1 ? "Uploading…" : "Upload"}
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
                              className="btn btn-solid"
                              disabled={
                                busy || !gallery || gallery.mediaCount === 0
                              }
                              onClick={() => publish(order.id)}
                            >
                              {busy && phase === 2
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
                              className="btn btn-outline"
                              disabled={busy || !gallery || paid}
                              onClick={() => forceUnlock(order.id)}
                            >
                              {paid ? "Already unlocked" : "Mark paid & unlock"}
                            </button>
                          </div>
                        </div>
                      </li>
                    </ol>

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
