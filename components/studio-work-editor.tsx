"use client";

import { useCallback, useRef, useState } from "react";
import type { GalleryImage, Tenant } from "@/lib/tenant-schema";
import { PhotoDropzone } from "@/components/photo-dropzone";
import { SortablePhotoGrid } from "@/components/sortable-photo-grid";
import { StickySaveBar } from "@/components/sticky-save-bar";
import { UploadTray } from "@/components/upload-tray";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import {
  PORTFOLIO_MAX_BYTES,
  useUploadQueue,
  type UploadBatchResult,
  type UploadQueueItem,
} from "@/lib/upload-queue";
import { toastError, toastSuccess } from "@/lib/toast";

function emptyImage(): GalleryImage {
  return {
    src: "",
    alt: "",
    width: 1800,
    height: 1200,
    room: "",
    note: "",
    wide: false,
  };
}

function isLocalUpload(src: string) {
  return src.startsWith("/api/site-media/");
}

function galleryKey(image: GalleryImage, index: number) {
  return image.src ? `src:${image.src}` : `idx:${index}`;
}

export function StudioWorkEditor({
  tenant,
  viewUrl,
}: {
  tenant: Tenant;
  viewUrl: string;
}) {
  const [photographerName, setPhotographerName] = useState(tenant.photographerName);
  const [tagline, setTagline] = useState(tenant.tagline);
  const [lede, setLede] = useState(tenant.lede);
  const [heroSrc, setHeroSrc] = useState(tenant.hero.src);
  const [heroAlt, setHeroAlt] = useState(tenant.hero.alt);
  const [heroWidth, setHeroWidth] = useState(tenant.hero.width);
  const [heroHeight, setHeroHeight] = useState(tenant.hero.height);
  const [gallery, setGallery] = useState<GalleryImage[]>(
    tenant.gallery.length > 0 ? tenant.gallery : [],
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHeroUrl, setShowHeroUrl] = useState(
    Boolean(tenant.hero.src && !isLocalUpload(tenant.hero.src)),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const replaceIndexRef = useRef<number | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const current = JSON.stringify({
    photographerName,
    tagline,
    lede,
    heroSrc,
    heroAlt,
    heroWidth,
    heroHeight,
    gallery,
  });
  const [saved, setSaved] = useState(current);
  useUnsavedChanges(current !== saved);

  const onFileDone = useCallback(
    (_file: File, responseJson: unknown, item: UploadQueueItem) => {
      const json = responseJson as {
        src?: string;
        width?: number;
        height?: number;
        alt?: string;
      };
      if (!json.src) return;
      const role = item.meta?.role;
      if (role === "hero") {
        setHeroSrc(json.src);
        setHeroWidth(json.width ?? 1800);
        setHeroHeight(json.height ?? 1200);
        setHeroAlt((alt) => (alt.trim() ? alt : json.alt ?? ""));
        setMessage("Hero uploaded — click Save work to publish.");
        toastSuccess("Hero uploaded — click Save work to publish.");
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        return;
      }
      if (role === "replace") {
        const index = Number(item.meta?.index ?? -1);
        if (index >= 0) {
          setGallery((list) =>
            list.map((image, i) =>
              i === index
                ? {
                    ...image,
                    src: json.src!,
                    alt: image.alt || json.alt || "",
                    width: json.width ?? 1800,
                    height: json.height ?? 1200,
                  }
                : image,
            ),
          );
          setMessage("Photo replaced — click Save work to publish.");
          toastSuccess("Photo replaced — click Save work to publish.");
        }
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        return;
      }
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    },
    [],
  );

  const onBatchComplete = useCallback((results: UploadBatchResult[]) => {
    const galleryUploads = results.filter(
      (result) => result.ok && result.meta?.role === "gallery",
    );
    if (galleryUploads.length === 0) return;
    const uploaded: GalleryImage[] = galleryUploads.map((result) => {
      const json = result.response as {
        src?: string;
        width?: number;
        height?: number;
        alt?: string;
      };
      return {
        src: json.src ?? "",
        alt: json.alt ?? "",
        width: json.width ?? 1800,
        height: json.height ?? 1200,
        room: "",
        note: "",
        wide: false,
      };
    }).filter((image) => image.src);
    if (uploaded.length === 0) return;
    setGallery((currentGallery) => [
      ...currentGallery.filter((image) => image.src.trim()),
      ...uploaded,
    ]);
    setMessage(
      `${uploaded.length} photo${uploaded.length === 1 ? "" : "s"} uploaded — click Save work to publish.`,
    );
    toastSuccess(
      `${uploaded.length} photo${uploaded.length === 1 ? "" : "s"} uploaded — click Save work to publish.`,
    );
  }, []);

  const uploadQueue = useUploadQueue({
    url: "/api/admin/portfolio/upload",
    fieldName: "file",
    concurrency: 3,
    maxBytes: PORTFOLIO_MAX_BYTES,
    onFileDone,
    onBatchComplete,
    onError: (msg) => {
      setError(msg);
      toastError(msg);
    },
  });

  function updateImage(index: number, patch: Partial<GalleryImage>) {
    setGallery((currentGallery) =>
      currentGallery.map((image, i) =>
        i === index ? { ...image, ...patch } : image,
      ),
    );
  }

  function enqueueGallery(files: File[]) {
    uploadQueue.enqueue(files, { meta: { role: "gallery" } });
  }

  function enqueueHero(files: File[]) {
    const file = files[0];
    if (!file) return;
    uploadQueue.enqueue([file], { meta: { role: "hero" } });
  }

  function enqueueReplace(index: number, files: File[]) {
    const file = files[0];
    if (!file) return;
    replaceIndexRef.current = index;
    uploadQueue.enqueue([file], { meta: { role: "replace", index } });
  }

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const cleaned = gallery.filter((image) => image.src.trim());
      const response = await fetch("/api/admin/site", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "work",
          photographerName,
          tagline,
          lede,
          hero: {
            ...tenant.hero,
            src: heroSrc,
            alt: heroAlt,
            width: heroWidth,
            height: heroHeight,
          },
          gallery: cleaned,
          portfolioComplete: cleaned.length > 0 && Boolean(heroSrc.trim()),
        }),
      });
      const json = await response.json();
      if (!json.ok) {
        setError(json.error ?? "Could not save.");
        toastError(json.error ?? "Could not save.");
        return;
      }
      setGallery(cleaned.length > 0 ? cleaned : []);
      setMessage("Work page saved.");
      toastSuccess("Work page saved.");
      setSaved(
        JSON.stringify({
          photographerName,
          tagline,
          lede,
          heroSrc,
          heroAlt,
          heroWidth,
          heroHeight,
          gallery: cleaned,
        }),
      );
    } catch {
      setError("Network error.");
      toastError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  const selectedIndex =
    selectedId == null
      ? -1
      : gallery.findIndex((image, index) => galleryKey(image, index) === selectedId);
  const selectedImage = selectedIndex >= 0 ? gallery[selectedIndex] : null;
  const uploading = uploadQueue.stats.activeCount > 0;

  const gridItems = [
    ...gallery.map((image, index) => ({
      id: galleryKey(image, index),
      src: image.src || "/placeholder.svg",
      label: image.room || image.alt || `Photo ${index + 1}`,
    })),
    ...uploadQueue.items
      .filter(
        (item) =>
          item.meta?.role === "gallery" && item.status !== "done",
      )
      .map((item) => ({
        id: item.id,
        src: item.previewUrl,
        label: item.file.name,
        queued: true,
        progress: item.progress,
        statusLabel:
          item.status === "failed"
            ? "Failed"
            : item.status === "processing"
              ? "Processing…"
              : `${item.progress}%`,
      })),
  ];

  return (
    <form
      id="studio-work-form"
      className="studio-settings studio-settings--wide"
      onSubmit={onSave}
    >
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">Work</p>
          <h1>Home & portfolio</h1>
          <p className="muted">
            This is what agents see first. Keep the hero and selected work current.
          </p>
        </div>
        <div className="admin-toolbar-actions">
          <input
            ref={galleryInputRef}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            multiple
            disabled={uploading}
            onChange={(event) => {
              if (event.target.files?.length) {
                enqueueGallery(Array.from(event.target.files));
              }
              event.target.value = "";
            }}
          />
          <button
            type="button"
            className={`btn btn-solid${uploading ? " is-busy" : ""}`}
            disabled={uploading}
            onClick={() => galleryInputRef.current?.click()}
          >
            {uploading ? "Uploading…" : "Upload photos"}
          </button>
          <a className="btn btn-outline" href={viewUrl} target="_blank" rel="noreferrer">
            View on site
          </a>
        </div>
      </div>

      <section className="studio-section">
        <h2>Intro</h2>
        <label className="field">
          <span>Photographer name</span>
          <input
            value={photographerName}
            onChange={(event) => setPhotographerName(event.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Tagline</span>
          <input value={tagline} onChange={(event) => setTagline(event.target.value)} required />
        </label>
        <label className="field">
          <span>Lede</span>
          <textarea value={lede} onChange={(event) => setLede(event.target.value)} rows={3} />
        </label>
      </section>

      <section className="studio-section">
        <h2>Hero image</h2>
        <p className="studio-section-lede">Drop a photo to replace. JPG, PNG, or WebP up to 12MB.</p>
        <PhotoDropzone
          className="work-hero-drop"
          multiple={false}
          disabled={uploading}
          onFiles={enqueueHero}
          label={heroSrc ? "Drop to replace hero" : "Drop hero photo here"}
        >
          {heroSrc ? (
            <div className="work-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroSrc} alt={heroAlt || "Hero preview"} />
            </div>
          ) : null}
        </PhotoDropzone>
        <button
          type="button"
          className="text-link"
          onClick={() => setShowHeroUrl((open) => !open)}
        >
          {showHeroUrl ? "Hide URL" : "Use image URL instead"}
        </button>
        {showHeroUrl ? (
          <label className="field">
            <span>Image URL</span>
            <input
              value={heroSrc}
              onChange={(event) => setHeroSrc(event.target.value)}
              placeholder="https://"
            />
          </label>
        ) : null}
        <label className="field">
          <span>Alt text</span>
          <input value={heroAlt} onChange={(event) => setHeroAlt(event.target.value)} />
        </label>
      </section>

      <section className="studio-section">
        <h2>Selected work</h2>
        <p className="studio-section-lede">
          Drop photos to add them. Drag to reorder. Click a thumbnail to edit details. Order saves with Save work.
        </p>
        <PhotoDropzone
          className="work-gallery-drop"
          disabled={uploading && uploadQueue.stats.activeCount > 8}
          onFiles={enqueueGallery}
        >
          {gridItems.length === 0 ? (
            <p className="studio-empty-inline">No portfolio photos yet.</p>
          ) : (
            <SortablePhotoGrid
              items={gridItems}
              showIndex
              emptyMessage="No portfolio photos yet."
              onReorder={(ids) => {
                const byId = new Map(
                  gallery.map((image, index) => [galleryKey(image, index), image]),
                );
                const next = ids
                  .map((id) => byId.get(id))
                  .filter((image): image is GalleryImage => Boolean(image));
                if (next.length > 0) setGallery(next);
              }}
              onActivate={(id) => setSelectedId(id)}
              onSelect={(ids) => {
                if (ids.length === 1) setSelectedId(ids[0] ?? null);
              }}
            />
          )}
        </PhotoDropzone>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            setGallery((currentGallery) => [...currentGallery, emptyImage()]);
          }}
        >
          Add URL row
        </button>
      </section>

      {selectedImage && selectedIndex >= 0 ? (
        <aside className="work-details-drawer" aria-label="Photo details">
          <div className="work-details-drawer-head">
            <strong>Photo details</strong>
            <button
              type="button"
              className="text-link"
              onClick={() => setSelectedId(null)}
            >
              Close
            </button>
          </div>
          <div className="work-preview work-preview--thumb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImage.src}
              alt={selectedImage.alt || `Photo ${selectedIndex + 1}`}
            />
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Room</span>
              <input
                value={selectedImage.room}
                onChange={(event) =>
                  updateImage(selectedIndex, { room: event.target.value })
                }
              />
            </label>
            <label className="field">
              <span>Note</span>
              <input
                value={selectedImage.note}
                onChange={(event) =>
                  updateImage(selectedIndex, { note: event.target.value })
                }
              />
            </label>
          </div>
          <label className="field">
            <span>Alt text</span>
            <input
              value={selectedImage.alt}
              onChange={(event) =>
                updateImage(selectedIndex, { alt: event.target.value })
              }
            />
          </label>
          <label className="field field-check">
            <span>
              <input
                type="checkbox"
                checked={Boolean(selectedImage.wide)}
                onChange={(event) =>
                  updateImage(selectedIndex, { wide: event.target.checked })
                }
              />{" "}
              Wide frame
            </span>
          </label>
          <label className="field">
            <span>Image URL</span>
            <input
              value={selectedImage.src}
              onChange={(event) =>
                updateImage(selectedIndex, { src: event.target.value })
              }
            />
          </label>
          <div className="work-upload-row">
            <label className="btn btn-outline">
              Replace
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                disabled={uploading}
                onChange={(event) => {
                  if (event.target.files?.length) {
                    enqueueReplace(selectedIndex, Array.from(event.target.files));
                  }
                  event.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setGallery((currentGallery) =>
                  currentGallery.filter((_, i) => i !== selectedIndex),
                );
                setSelectedId(null);
              }}
            >
              Remove
            </button>
          </div>
        </aside>
      ) : null}

      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      <StickySaveBar
        dirty={current !== saved}
        busy={busy || uploading}
        label="Save work"
        formId="studio-work-form"
      />

      <UploadTray
        items={uploadQueue.items}
        onRetryFailed={uploadQueue.retryAllFailed}
        onCancelAll={uploadQueue.cancelAll}
        onDismiss={uploadQueue.clearDone}
      />
    </form>
  );
}
