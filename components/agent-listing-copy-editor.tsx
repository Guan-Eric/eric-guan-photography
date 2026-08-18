"use client";

import { useState } from "react";
import Link from "next/link";
import type { ListingSection, OpenHouse } from "@/lib/listing-content";
import { UnsavedChangesProvider, useUnsavedChanges } from "@/components/unsaved-changes";
import { toastError, toastSuccess } from "@/lib/toast";

type CopyState = {
  headline: string;
  description: string;
  sections: ListingSection[];
  openHouses: OpenHouse[];
  leadCapture: boolean;
};

function AgentListingCopyForm({
  pageId,
  publicUrl,
  propertyAddress,
  initial,
}: {
  pageId: string;
  publicUrl: string;
  propertyAddress: string;
  initial: CopyState;
}) {
  const [state, setState] = useState<CopyState>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const current = JSON.stringify(state);
  const [saved, setSaved] = useState(current);
  useUnsavedChanges(current !== saved);

  function patch(next: Partial<CopyState>) {
    setState((current) => ({ ...current, ...next }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/portal/listings/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline: state.headline,
          description: state.description,
          sections: state.sections.filter(
            (section) => section.heading.trim() || section.body.trim(),
          ),
          openHouses: state.openHouses.filter((entry) => entry.date.trim()),
          leadCapture: state.leadCapture,
        }),
      });
      const json = await response.json().catch(() => null);
      if (!json?.ok) {
        setError(json?.error ?? "Could not save listing copy.");
        toastError(json?.error ?? "Could not save listing copy.");
        return;
      }
      setNotice("Saved.");
      toastSuccess("Listing copy saved.");
      setSaved(current);
    } catch {
      setError("Network error.");
      toastError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="studio-settings listing-editor">
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">Listing copy</p>
          <h1>{propertyAddress}</h1>
          <p className="muted">
            <Link className="text-link" href="/portal">
              Back to your listings
            </Link>
            {" · "}
            <a className="text-link" href={publicUrl} target="_blank" rel="noreferrer">
              View listing page
            </a>
          </p>
        </div>
        <button
          type="button"
          className={`btn btn-solid${busy ? " is-busy" : ""}`}
          disabled={busy}
          onClick={save}
        >
          {busy ? "Saving…" : "Save copy"}
        </button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="form-success">{notice}</p> : null}

      <p className="field-hint">
        Photos and the page look are set by the photographer. Add the words buyers
        see — optional, the page can go live with just the address.
      </p>

      <section className="studio-section">
        <h2>Copy</h2>
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
        <h2>Enquiries</h2>
        <label className="field-check">
          <span>
            <input
              type="checkbox"
              checked={state.leadCapture}
              onChange={(event) => patch({ leadCapture: event.target.checked })}
            />
            Show the enquiry form (emails you)
          </span>
        </label>
        <button
          type="button"
          className={`btn btn-solid${busy ? " is-busy" : ""}`}
          disabled={busy}
          onClick={save}
        >
          {busy ? "Saving…" : "Save copy"}
        </button>
      </section>
    </div>
  );
}

export function AgentListingCopyEditor(props: {
  pageId: string;
  publicUrl: string;
  propertyAddress: string;
  initial: CopyState;
}) {
  return (
    <UnsavedChangesProvider>
      <AgentListingCopyForm {...props} />
    </UnsavedChangesProvider>
  );
}
