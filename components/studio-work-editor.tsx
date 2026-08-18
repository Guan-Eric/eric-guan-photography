"use client";

import { useRef, useState } from "react";
import type { GalleryImage, Tenant } from "@/lib/tenant-schema";
import { useUnsavedChanges } from "@/components/unsaved-changes";
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
  const [uploading, setUploading] = useState<string | null>(null);
  const [showHeroUrl, setShowHeroUrl] = useState(
    Boolean(tenant.hero.src && !isLocalUpload(tenant.hero.src)),
  );
  const heroInputRef = useRef<HTMLInputElement>(null);
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

  function updateImage(index: number, patch: Partial<GalleryImage>) {
    setGallery((current) =>
      current.map((image, i) => (i === index ? { ...image, ...patch } : image)),
    );
  }

  async function uploadOne(file: File) {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/admin/portfolio/upload", {
      method: "POST",
      body: form,
    });
    const json = await response.json();
    if (!json.ok) {
      throw new Error(json.error ?? "Upload failed.");
    }
    return json as {
      src: string;
      width: number;
      height: number;
      alt: string;
    };
  }

  async function uploadHero(file: File) {
    setUploading("hero");
    setError(null);
    try {
      const json = await uploadOne(file);
      setHeroSrc(json.src);
      setHeroWidth(json.width);
      setHeroHeight(json.height);
      if (!heroAlt.trim()) setHeroAlt(json.alt ?? "");
      setMessage("Hero uploaded — click Save work to publish.");
      toastSuccess("Hero uploaded — click Save work to publish.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      setError(message);
      toastError(message);
    } finally {
      setUploading(null);
    }
  }

  async function uploadGalleryFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading("gallery");
    setError(null);
    try {
      const uploaded: GalleryImage[] = [];
      for (const file of list) {
        const json = await uploadOne(file);
        uploaded.push({
          src: json.src,
          alt: json.alt ?? "",
          width: json.width ?? 1800,
          height: json.height ?? 1200,
          room: "",
          note: "",
          wide: false,
        });
      }
      setGallery((current) => [...current.filter((image) => image.src.trim()), ...uploaded]);
      setMessage(
        `${uploaded.length} photo${uploaded.length === 1 ? "" : "s"} uploaded — click Save work to publish.`,
      );
      toastSuccess(
        `${uploaded.length} photo${uploaded.length === 1 ? "" : "s"} uploaded — click Save work to publish.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      setError(message);
      toastError(message);
    } finally {
      setUploading(null);
    }
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

  return (
    <form className="studio-settings studio-settings--wide" onSubmit={onSave}>
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">Work</p>
          <h1>Home & portfolio</h1>
        </div>
        <a className="btn btn-outline" href={viewUrl} target="_blank" rel="noreferrer">
          View on site
        </a>
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
        <p className="studio-section-lede">Upload from your computer. JPG, PNG, or WebP up to 12MB.</p>
        {heroSrc ? (
          <div className="work-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroSrc} alt={heroAlt || "Hero preview"} />
          </div>
        ) : null}
        <div className="work-upload-row">
          <input
            ref={heroInputRef}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            disabled={uploading === "hero"}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadHero(file);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            className={`btn btn-solid${uploading === "hero" ? " is-busy" : ""}`}
            disabled={Boolean(uploading)}
            onClick={() => heroInputRef.current?.click()}
          >
            {uploading === "hero" ? "Uploading…" : "Choose from computer"}
          </button>
          <button
            type="button"
            className="text-link"
            onClick={() => setShowHeroUrl((open) => !open)}
          >
            {showHeroUrl ? "Hide URL" : "Use image URL instead"}
          </button>
        </div>
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
          Upload one or many photos from your machine. They appear on the home page after you save.
        </p>
        <div className="work-upload-row">
          <input
            ref={galleryInputRef}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            multiple
            disabled={uploading === "gallery"}
            onChange={(event) => {
              if (event.target.files?.length) {
                void uploadGalleryFiles(event.target.files);
              }
              event.target.value = "";
            }}
          />
          <button
            type="button"
            className={`btn btn-solid${uploading === "gallery" ? " is-busy" : ""}`}
            disabled={Boolean(uploading)}
            onClick={() => galleryInputRef.current?.click()}
          >
            {uploading === "gallery" ? "Uploading…" : "Upload photos"}
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setGallery((current) => [...current, emptyImage()])}
          >
            Add URL row
          </button>
        </div>

        {gallery.length === 0 ? (
          <p className="studio-empty-inline">No portfolio photos yet.</p>
        ) : (
          <div className="studio-editor-list">
            {gallery.map((image, index) => (
              <div key={`${image.src}-${index}`} className="studio-editor-item work-editor-card">
                {image.src ? (
                  <div className="work-preview work-preview--thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.src} alt={image.alt || `Photo ${index + 1}`} />
                  </div>
                ) : null}
                <label className="field">
                  <span>Replace from computer</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                    disabled={Boolean(uploading)}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      setUploading(`gallery-${index}`);
                      setError(null);
                      void uploadOne(file)
                        .then((json) => {
                          updateImage(index, {
                            src: json.src,
                            alt: image.alt || json.alt || "",
                            width: json.width ?? 1800,
                            height: json.height ?? 1200,
                          });
                          setMessage("Photo replaced — click Save work to publish.");
                        })
                        .catch((err: unknown) => {
                          setError(err instanceof Error ? err.message : "Upload failed.");
                        })
                        .finally(() => setUploading(null));
                      event.target.value = "";
                    }}
                  />
                </label>
                <label className="field">
                  <span>Image URL</span>
                  <input
                    value={image.src}
                    onChange={(event) => updateImage(index, { src: event.target.value })}
                    placeholder="https:// or uploaded path"
                  />
                </label>
                <div className="form-grid">
                  <label className="field">
                    <span>Room</span>
                    <input
                      value={image.room}
                      onChange={(event) => updateImage(index, { room: event.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Note</span>
                    <input
                      value={image.note}
                      onChange={(event) => updateImage(index, { note: event.target.value })}
                    />
                  </label>
                </div>
                <label className="field">
                  <span>Alt text</span>
                  <input
                    value={image.alt}
                    onChange={(event) => updateImage(index, { alt: event.target.value })}
                  />
                </label>
                <div className="studio-editor-row">
                  <label className="field field-check">
                    <span>
                      <input
                        type="checkbox"
                        checked={Boolean(image.wide)}
                        onChange={(event) => updateImage(index, { wide: event.target.checked })}
                      />{" "}
                      Wide frame
                    </span>
                  </label>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() =>
                      setGallery((current) => current.filter((_, i) => i !== index))
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      <button className={`btn btn-solid${busy ? " is-busy" : ""}`} type="submit" disabled={busy || Boolean(uploading)}>
        {busy ? "Saving…" : "Save work"}
      </button>
    </form>
  );
}
