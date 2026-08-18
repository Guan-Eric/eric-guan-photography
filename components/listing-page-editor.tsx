"use client";

import { useState } from "react";
import {
  LISTING_THEMES,
  LISTING_THEME_DEFS,
  type ListingTheme,
  listingThemeStyle,
} from "@/lib/listing-themes";
import { ListingDomainEditor } from "@/components/listing-domain-editor";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import { toastError, toastSuccess } from "@/lib/toast";

type EditorState = {
  theme: ListingTheme;
  heroAssetId: string;
  brandMode: "branded" | "unbranded";
  published: boolean;
  captions: Record<string, string>;
};

export function ListingPageEditor({
  pageId,
  publicUrl,
  initial,
  photos,
  propertyAddress,
}: {
  pageId: string;
  publicUrl: string;
  initial: EditorState;
  photos: Array<{ id: string; caption: string }>;
  propertyAddress: string;
}) {
  const [state, setState] = useState<EditorState>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const current = JSON.stringify(state);
  const [saved, setSaved] = useState(current);
  useUnsavedChanges(current !== saved);

  function patch(next: Partial<EditorState>) {
    setState((current) => ({ ...current, ...next }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/listings/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: state.theme,
          heroAssetId: state.heroAssetId || null,
          brandMode: state.brandMode,
          published: state.published,
          captions: photos.map((photo) => ({
            id: photo.id,
            caption: state.captions[photo.id] ?? "",
          })),
        }),
      });
      const json = await response.json().catch(() => null);
      if (!json?.ok) {
        setError(json?.error ?? "Could not save this page.");
        toastError(json?.error ?? "Could not save this page.");
        return;
      }
      setNotice("Saved.");
      toastSuccess("Listing page saved.");
      setSaved(current);
    } catch {
      setError("Network error.");
      toastError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  const hero = state.heroAssetId || photos[0]?.id || null;

  return (
    <div className="studio-settings listing-editor">
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">Listing page</p>
          <h1>{propertyAddress}</h1>
          <p className="muted">
            <a className="text-link" href={publicUrl} target="_blank" rel="noreferrer">
              View listing page
            </a>
          </p>
        </div>
        <button type="button" className={`btn btn-solid${busy ? " is-busy" : ""}`} disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save page"}
        </button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="form-success">{notice}</p> : null}

      <p className="field-hint">
        Headline, description, extra sections, and open houses are written by the
        agent in their listings portal.
      </p>

      <section className="studio-section">
        <h2>Look</h2>
        <div className="theme-pick">
          {LISTING_THEMES.map((theme) => (
            <button
              key={theme}
              type="button"
              className={state.theme === theme ? "is-current" : undefined}
              onClick={() => patch({ theme })}
              style={listingThemeStyle(theme)}
            >
              <strong>{LISTING_THEME_DEFS[theme].label}</strong>
              <span>{LISTING_THEME_DEFS[theme].blurb}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="studio-section">
        <h2>Photos</h2>
        <p className="field-hint">
          Choose the hero. Optional captions show on the public page — filenames
          never do.
        </p>
        {photos.length === 0 ? (
          <p className="field-hint">Upload photos on the order first.</p>
        ) : (
          <div className="hero-pick">
            {photos.map((photo) => {
              const caption = state.captions[photo.id] ?? "";
              const selected = hero === photo.id;
              return (
                <div key={photo.id} className="hero-pick-item">
                  <button
                    type="button"
                    className={selected ? "is-current" : undefined}
                    aria-pressed={selected}
                    aria-label={
                      caption
                        ? `Use “${caption}” as the hero photo`
                        : "Use as hero photo"
                    }
                    onClick={() => patch({ heroAssetId: photo.id })}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/admin/listings/${pageId}/media/${photo.id}`}
                      alt=""
                      loading="lazy"
                    />
                  </button>
                  <label className="field">
                    <span className="visually-hidden">Caption</span>
                    <input
                      value={caption}
                      maxLength={80}
                      placeholder="Caption (optional)"
                      onChange={(event) =>
                        patch({
                          captions: {
                            ...state.captions,
                            [photo.id]: event.target.value,
                          },
                        })
                      }
                    />
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="studio-section">
        <h2>Visibility</h2>
        <label className="field-check">
          <span>
            <input
              type="checkbox"
              checked={state.published}
              onChange={(event) => patch({ published: event.target.checked })}
            />
            Published
          </span>
        </label>
        <label className="field">
          <span>Branding</span>
          <select
            value={state.brandMode}
            onChange={(event) =>
              patch({ brandMode: event.target.value as "branded" | "unbranded" })
            }
          >
            <option value="branded">Branded (agent details shown)</option>
            <option value="unbranded">Unbranded (MLS safe)</option>
          </select>
        </label>
        <button type="button" className={`btn btn-solid${busy ? " is-busy" : ""}`} disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save page"}
        </button>
      </section>

      <ListingDomainEditor pageId={pageId} />
    </div>
  );
}
