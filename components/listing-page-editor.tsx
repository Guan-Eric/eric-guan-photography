"use client";

import { useState } from "react";
import type { ListingSection, OpenHouse } from "@/lib/listing-content";
import {
  LISTING_THEMES,
  LISTING_THEME_DEFS,
  type ListingTheme,
  listingThemeStyle,
} from "@/lib/listing-themes";
import { ListingDomainEditor } from "@/components/listing-domain-editor";
import { toastError, toastSuccess } from "@/lib/toast";

type EditorState = {
  title: string;
  headline: string;
  description: string;
  theme: ListingTheme;
  heroAssetId: string;
  sections: ListingSection[];
  openHouses: OpenHouse[];
  leadCapture: boolean;
  brandMode: "branded" | "unbranded";
  published: boolean;
};

export function ListingPageEditor({
  pageId,
  slug,
  publicUrl,
  initial,
  photos,
  propertyAddress,
}: {
  pageId: string;
  slug: string;
  publicUrl: string;
  initial: EditorState;
  photos: Array<{ id: string; label: string }>;
  propertyAddress: string;
}) {
  const [state, setState] = useState<EditorState>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
          title: state.title,
          headline: state.headline,
          description: state.description,
          theme: state.theme,
          heroAssetId: state.heroAssetId || null,
          sections: state.sections.filter(
            (section) => section.heading.trim() || section.body.trim(),
          ),
          openHouses: state.openHouses.filter((entry) => entry.date.trim()),
          leadCapture: state.leadCapture,
          brandMode: state.brandMode,
          published: state.published,
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
            <a href={publicUrl} target="_blank" rel="noreferrer">
              /p/{slug}
            </a>
          </p>
        </div>
        <button type="button" className={`btn btn-solid${busy ? " is-busy" : ""}`} disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save page"}
        </button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="form-success">{notice}</p> : null}

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
        <h2>Copy</h2>
        <label className="field">
          <span>Page title</span>
          <input
            value={state.title}
            onChange={(event) => patch({ title: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Headline</span>
          <input
            value={state.headline}
            placeholder="Sun-filled semi steps from the park"
            onChange={(event) => patch({ headline: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea
            rows={5}
            value={state.description}
            placeholder="Two paragraphs on what makes this home worth a showing."
            onChange={(event) => patch({ description: event.target.value })}
          />
        </label>
      </section>

      <section className="studio-section">
        <h2>Hero photo</h2>
        {photos.length === 0 ? (
          <p className="field-hint">Upload photos on the order first.</p>
        ) : (
          <div className="hero-pick">
            {photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                className={hero === photo.id ? "is-current" : undefined}
                onClick={() => patch({ heroAssetId: photo.id })}
                title={photo.label}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/p/${slug}/media/${photo.id}`} alt={photo.label} loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="studio-section">
        <h2>Sections</h2>
        <p className="field-hint">
          Optional blocks under the photos — features, neighbourhood notes, school
          catchment.
        </p>
        {state.sections.map((section, index) => (
          <div key={index} className="editor-block">
            <label className="field">
              <span>Heading</span>
              <input
                value={section.heading}
                onChange={(event) =>
                  patch({
                    sections: state.sections.map((item, i) =>
                      i === index ? { ...item, heading: event.target.value } : item,
                    ),
                  })
                }
              />
            </label>
            <label className="field">
              <span>Body</span>
              <textarea
                rows={3}
                value={section.body}
                onChange={(event) =>
                  patch({
                    sections: state.sections.map((item, i) =>
                      i === index ? { ...item, body: event.target.value } : item,
                    ),
                  })
                }
              />
            </label>
            <button
              type="button"
              className="text-link"
              onClick={() =>
                patch({ sections: state.sections.filter((_, i) => i !== index) })
              }
            >
              Remove section
            </button>
          </div>
        ))}
        {state.sections.length < 8 ? (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() =>
              patch({ sections: [...state.sections, { heading: "", body: "" }] })
            }
          >
            Add section
          </button>
        ) : null}
      </section>

      <section className="studio-section">
        <h2>Open houses</h2>
        {state.openHouses.map((entry, index) => (
          <div key={index} className="editor-block editor-block--row">
            <label className="field">
              <span>Date</span>
              <input
                type="date"
                value={entry.date}
                onChange={(event) =>
                  patch({
                    openHouses: state.openHouses.map((item, i) =>
                      i === index ? { ...item, date: event.target.value } : item,
                    ),
                  })
                }
              />
            </label>
            <label className="field">
              <span>From</span>
              <input
                type="time"
                value={entry.start}
                onChange={(event) =>
                  patch({
                    openHouses: state.openHouses.map((item, i) =>
                      i === index ? { ...item, start: event.target.value } : item,
                    ),
                  })
                }
              />
            </label>
            <label className="field">
              <span>To</span>
              <input
                type="time"
                value={entry.end}
                onChange={(event) =>
                  patch({
                    openHouses: state.openHouses.map((item, i) =>
                      i === index ? { ...item, end: event.target.value } : item,
                    ),
                  })
                }
              />
            </label>
            <button
              type="button"
              className="text-link"
              onClick={() =>
                patch({ openHouses: state.openHouses.filter((_, i) => i !== index) })
              }
            >
              Remove
            </button>
          </div>
        ))}
        {state.openHouses.length < 8 ? (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() =>
              patch({
                openHouses: [
                  ...state.openHouses,
                  { date: "", start: "", end: "", note: "" },
                ],
              })
            }
          >
            Add open house
          </button>
        ) : null}
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
        <label className="field-check">
          <span>
            <input
              type="checkbox"
              checked={state.leadCapture}
              onChange={(event) => patch({ leadCapture: event.target.checked })}
            />
            Show the enquiry form (emails the agent)
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
