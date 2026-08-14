"use client";

import { useState } from "react";
import type { GalleryImage, Tenant } from "@/lib/tenant-schema";

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
  const [gallery, setGallery] = useState<GalleryImage[]>(
    tenant.gallery.length > 0 ? tenant.gallery : [emptyImage()],
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function updateImage(index: number, patch: Partial<GalleryImage>) {
    setGallery((current) =>
      current.map((image, i) => (i === index ? { ...image, ...patch } : image)),
    );
  }

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/site", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "work",
          photographerName,
          tagline,
          lede,
          hero: { ...tenant.hero, src: heroSrc, alt: heroAlt },
          gallery,
        }),
      });
      const json = await response.json();
      if (!json.ok) {
        setError(json.error ?? "Could not save.");
        return;
      }
      setMessage("Work page saved.");
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="studio-settings" onSubmit={onSave}>
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
        <label className="field">
          <span>Image URL</span>
          <input
            value={heroSrc}
            onChange={(event) => setHeroSrc(event.target.value)}
            placeholder="https://"
          />
        </label>
        <label className="field">
          <span>Alt text</span>
          <input value={heroAlt} onChange={(event) => setHeroAlt(event.target.value)} />
        </label>
      </section>

      <section className="studio-section">
        <h2>Selected work</h2>
        <div className="studio-editor-list">
          {gallery.map((image, index) => (
            <div key={`${image.src}-${index}`} className="studio-editor-item">
              <label className="field">
                <span>Image URL</span>
                <input
                  value={image.src}
                  onChange={(event) => updateImage(index, { src: event.target.value })}
                  placeholder="https://"
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
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => setGallery((current) => [...current, emptyImage()])}
        >
          Add photo
        </button>
      </section>

      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      <button className="btn btn-solid" type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save work"}
      </button>
    </form>
  );
}
