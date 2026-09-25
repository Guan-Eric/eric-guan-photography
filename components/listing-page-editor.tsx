"use client";

import { useState } from "react";
import {
  AGENCY_LICENSE_TYPES,
  BROKER_LICENSE_TYPES,
  COMPLIANCE_REGIONS,
  ENHANCEMENT_TAGS,
  LISTING_STATUSES,
  type AgencyLicenseType,
  type BrokerLicenseType,
  type ComplianceRegion,
  type EnhancementTag,
  type ListingStatus,
} from "@/lib/db/schema";
import {
  AGENCY_LICENSE_LABELS,
  BROKER_LICENSE_LABELS,
  ENHANCEMENT_TAG_LABELS,
} from "@/lib/listing-compliance";
import {
  LISTING_THEMES,
  LISTING_THEME_DEFS,
  type ListingTheme,
  listingThemeStyle,
} from "@/lib/listing-themes";
import { ListingDomainEditor } from "@/components/listing-domain-editor";
import { SortablePhotoGrid } from "@/components/sortable-photo-grid";
import { StickySaveBar } from "@/components/sticky-save-bar";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import { toastError, toastSuccess } from "@/lib/toast";

type PhotoState = {
  id: string;
  caption: string;
  enhancementTag: EnhancementTag | null;
  originalDisclosureAssetId: string;
  disclosurePublic: boolean;
};

type EditorState = {
  theme: ListingTheme;
  heroAssetId: string;
  brandMode: "branded" | "unbranded";
  published: boolean;
  leadCapture: boolean;
  captions: Record<string, string>;
  brokerage: string;
  brokeragePhone: string;
  agentPhone: string;
  agentName: string;
  complianceRegion: ComplianceRegion;
  licenseDisplayName: string;
  licenseType: BrokerLicenseType | "";
  agencyLegalName: string;
  agencyLicenseType: AgencyLicenseType | "";
  listingStatus: ListingStatus;
  advertisingEndsAt: string;
  deedSignedAt: boolean;
  photos: PhotoState[];
};

function toDateInput(iso: string | null | undefined) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function fromDateInput(value: string) {
  if (!value.trim()) return null;
  return new Date(`${value}T23:59:59.000Z`).toISOString();
}

export function ListingPageEditor({
  pageId,
  orderId,
  publicUrl,
  previewUrl,
  listingState,
  listingStateLabel,
  checklistErrors = [],
  initial,
  propertyAddress,
}: {
  pageId: string;
  orderId?: string | null;
  publicUrl: string;
  previewUrl: string;
  listingState: "live" | "waiting_on_agent" | "draft" | "sold" | "ended" | "missing";
  listingStateLabel: string;
  checklistErrors?: string[];
  initial: EditorState;
  propertyAddress: string;
}) {
  const [state, setState] = useState<EditorState>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(
    initial.photos[0]?.id ?? null,
  );

  const current = JSON.stringify(state);
  const [saved, setSaved] = useState(current);
  useUnsavedChanges(current !== saved);

  function patch(next: Partial<EditorState>) {
    setState((currentState) => ({ ...currentState, ...next }));
  }

  function patchPhoto(id: string, next: Partial<PhotoState>) {
    setState((currentState) => ({
      ...currentState,
      photos: currentState.photos.map((photo) =>
        photo.id === id ? { ...photo, ...next } : photo,
      ),
      captions:
        next.caption !== undefined
          ? { ...currentState.captions, [id]: next.caption }
          : currentState.captions,
    }));
  }

  async function savePhotoOrder(ids: string[]) {
    if (!orderId) return;
    const previous = state.photos;
    const byId = new Map(previous.map((photo) => [photo.id, photo]));
    const next = ids
      .map((id) => byId.get(id))
      .filter((photo): photo is PhotoState => Boolean(photo));
    for (const photo of previous) {
      if (!ids.includes(photo.id)) next.push(photo);
    }
    patch({ photos: next });
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
        patch({ photos: previous });
        const message = json?.error ?? "Could not save photo order.";
        setError(message);
        toastError(message);
      }
    } catch {
      patch({ photos: previous });
      setError("Network error saving photo order.");
      toastError("Network error saving photo order.");
    }
  }

  async function save(extra?: { renew?: boolean }) {
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
          leadCapture: state.leadCapture,
          brokerage: state.brokerage,
          brokeragePhone: state.brokeragePhone,
          agentPhone: state.agentPhone,
          agentName: state.agentName,
          complianceRegion: state.complianceRegion,
          licenseDisplayName: state.licenseDisplayName || null,
          licenseType: state.licenseType || null,
          agencyLegalName: state.agencyLegalName || null,
          agencyLicenseType: state.agencyLicenseType || null,
          listingStatus: state.listingStatus,
          advertisingEndsAt: fromDateInput(state.advertisingEndsAt),
          deedSignedAt: state.deedSignedAt
            ? new Date().toISOString()
            : null,
          renew: extra?.renew ?? false,
          captions: state.photos.map((photo) => ({
            id: photo.id,
            caption: photo.caption,
          })),
          mediaTags: state.photos.map((photo) => ({
            id: photo.id,
            enhancementTag: photo.enhancementTag,
            originalDisclosureAssetId:
              photo.originalDisclosureAssetId || null,
            disclosurePublic: photo.disclosurePublic,
          })),
        }),
      });
      const json = await response.json().catch(() => null);
      if (!json?.ok) {
        const message =
          json?.checklistErrors?.join(" ") ??
          json?.error ??
          "Could not save this page.";
        setError(message);
        toastError(message);
        return;
      }
      setNotice(extra?.renew ? "Advertising window renewed (+12 months)." : "Saved.");
      toastSuccess(extra?.renew ? "Listing renewed." : "Listing page saved.");
      if (json.page?.advertisingEndsAt) {
        patch({ advertisingEndsAt: toDateInput(json.page.advertisingEndsAt) });
      }
      setSaved(JSON.stringify({
        ...state,
        advertisingEndsAt: json.page?.advertisingEndsAt
          ? toDateInput(json.page.advertisingEndsAt)
          : state.advertisingEndsAt,
      }));
    } catch {
      setError("Network error.");
      toastError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  const hero = state.heroAssetId || state.photos[0]?.id || null;
  const isQc = state.complianceRegion === "ca_qc";
  const activePhoto =
    state.photos.find((photo) => photo.id === activePhotoId) ??
    state.photos[0] ??
    null;

  return (
    <div className="studio-settings listing-editor">
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">Listing page</p>
          <h1>{propertyAddress}</h1>
          <p className="muted">
            <span className={`listing-state-badge is-${listingState}`}>
              {listingStateLabel}
            </span>
            {" · "}
            <a
              className="text-link"
              href={listingState === "live" ? publicUrl : previewUrl}
              target="_blank"
              rel="noreferrer"
            >
              {listingState === "live" ? "View listing page" : "Preview"}
            </a>
          </p>
        </div>
        <button type="button" className={`btn btn-solid${busy ? " is-busy" : ""}`} disabled={busy} onClick={() => save()}>
          {busy ? "Saving…" : "Save page"}
        </button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="form-success">{notice}</p> : null}

      {listingState !== "live" ? (
        <div className="listing-status-panel">
          <h2>{listingStateLabel}</h2>
          <p className="muted">
            {listingState === "waiting_on_agent"
              ? "The public page stays private until these items are finished (often by the agent in their portal)."
              : listingState === "sold"
                ? "Deed signed — the public page is taken down."
                : listingState === "ended"
                  ? "The advertising window has ended."
                  : "This page is not published yet."}
          </p>
          {checklistErrors.length > 0 ? (
            <ul>
              {checklistErrors.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <p className="field-hint">
        Brokerage identity and advertising window are required before publish.
        Keep unedited originals available for regulatory inspection — do not
        delete the gallery while the listing is marketed.
      </p>

      <section className="studio-section">
        <h2>Compliance</h2>
        <label className="field">
          <span>Region</span>
          <select
            value={state.complianceRegion}
            onChange={(event) =>
              patch({ complianceRegion: event.target.value as ComplianceRegion })
            }
          >
            {COMPLIANCE_REGIONS.map((region) => (
              <option key={region} value={region}>
                {region === "ca_qc"
                  ? "Québec (OACIQ)"
                  : region === "us_ca"
                    ? "California (AB 723)"
                    : "Canada (other)"}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Agent name</span>
          <input
            value={state.agentName}
            onChange={(event) => patch({ agentName: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Brokerage / agency (short)</span>
          <input
            value={state.brokerage}
            required
            onChange={(event) => patch({ brokerage: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Brokerage phone</span>
          <input
            value={state.brokeragePhone}
            placeholder="Office number"
            onChange={(event) => patch({ brokeragePhone: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Agent phone</span>
          <input
            value={state.agentPhone}
            onChange={(event) => patch({ agentPhone: event.target.value })}
          />
        </label>
        {isQc ? (
          <>
            <label className="field">
              <span>Licence display name (exact on OACIQ licence)</span>
              <input
                value={state.licenseDisplayName}
                onChange={(event) =>
                  patch({ licenseDisplayName: event.target.value })
                }
              />
            </label>
            <label className="field">
              <span>Broker licence type</span>
              <select
                value={state.licenseType}
                onChange={(event) =>
                  patch({
                    licenseType: event.target.value as BrokerLicenseType | "",
                  })
                }
              >
                <option value="">Select…</option>
                {BROKER_LICENSE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {BROKER_LICENSE_LABELS[type].en}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Agency legal name</span>
              <input
                value={state.agencyLegalName}
                onChange={(event) =>
                  patch({ agencyLegalName: event.target.value })
                }
              />
            </label>
            <label className="field">
              <span>Agency licence type</span>
              <select
                value={state.agencyLicenseType}
                onChange={(event) =>
                  patch({
                    agencyLicenseType: event.target.value as AgencyLicenseType | "",
                  })
                }
              >
                <option value="">Select…</option>
                {AGENCY_LICENSE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {AGENCY_LICENSE_LABELS[type].en}
                  </option>
                ))}
              </select>
            </label>
            <p className="field-hint">
              Québec listings must not show sale or asking price on the page.
            </p>
          </>
        ) : null}
        <label className="field">
          <span>Listing status</span>
          <select
            value={state.listingStatus}
            onChange={(event) =>
              patch({ listingStatus: event.target.value as ListingStatus })
            }
          >
            {LISTING_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Brokerage contract end (advertising window)</span>
          <input
            type="date"
            value={state.advertisingEndsAt}
            onChange={(event) =>
              patch({ advertisingEndsAt: event.target.value })
            }
          />
        </label>
        <label className="field-check">
          <span>
            <input
              type="checkbox"
              checked={state.deedSignedAt}
              onChange={(event) =>
                patch({ deedSignedAt: event.target.checked })
              }
            />
            Deed signed — unpublish now
          </span>
        </label>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={() => save({ renew: true })}
        >
          Renew advertising window (+12 months)
        </button>
      </section>

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
          Drag to reorder{orderId ? " (saves immediately)" : ""}. Click a photo
          to set it as the hero, then edit caption and enhancement tags below.
        </p>
        {state.photos.length === 0 ? (
          <p className="field-hint">Upload photos on the order first.</p>
        ) : (
          <>
            <SortablePhotoGrid
              showIndex
              items={state.photos.map((photo) => ({
                id: photo.id,
                src: `/api/admin/listings/${pageId}/media/${photo.id}`,
                label:
                  hero === photo.id
                    ? `${photo.caption || "Photo"} · Hero`
                    : photo.caption || undefined,
              }))}
              onReorder={(ids) => void savePhotoOrder(ids)}
              onActivate={(id) => {
                setActivePhotoId(id);
                patch({ heroAssetId: id });
              }}
              onSelect={(ids) => {
                if (ids.length === 1) {
                  setActivePhotoId(ids[0]!);
                  patch({ heroAssetId: ids[0]! });
                }
              }}
            />
            {activePhoto ? (
              <div className="listing-photo-details">
                <p className="eyebrow">Selected photo</p>
                <label className="field">
                  <span>Caption</span>
                  <input
                    value={activePhoto.caption}
                    maxLength={80}
                    placeholder="Caption (optional)"
                    onChange={(event) =>
                      patchPhoto(activePhoto.id, { caption: event.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>Enhancement</span>
                  <select
                    value={activePhoto.enhancementTag ?? ""}
                    onChange={(event) =>
                      patchPhoto(activePhoto.id, {
                        enhancementTag:
                          (event.target.value as EnhancementTag) || null,
                      })
                    }
                  >
                    <option value="">None (routine edit)</option>
                    {ENHANCEMENT_TAGS.map((tag) => (
                      <option key={tag} value={tag}>
                        {ENHANCEMENT_TAG_LABELS[tag].en}
                      </option>
                    ))}
                  </select>
                </label>
                {activePhoto.enhancementTag ? (
                  <label className="field">
                    <span>Unaltered counterpart</span>
                    <select
                      value={activePhoto.originalDisclosureAssetId}
                      onChange={(event) =>
                        patchPhoto(activePhoto.id, {
                          originalDisclosureAssetId: event.target.value,
                        })
                      }
                    >
                      <option value="">Select…</option>
                      {state.photos
                        .filter((row) => row.id !== activePhoto.id)
                        .map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.caption || row.id}
                          </option>
                        ))}
                    </select>
                  </label>
                ) : null}
                <label className="field-check">
                  <span>
                    <input
                      type="checkbox"
                      checked={activePhoto.disclosurePublic}
                      onChange={(event) =>
                        patchPhoto(activePhoto.id, {
                          disclosurePublic: event.target.checked,
                        })
                      }
                    />
                    Public unaltered original
                  </span>
                </label>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => patch({ heroAssetId: activePhoto.id })}
                >
                  {hero === activePhoto.id ? "Current hero" : "Set as hero"}
                </button>
              </div>
            ) : null}
          </>
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
            <option value="unbranded">Unbranded (not for public marketing)</option>
          </select>
        </label>
        <label className="field-check">
          <span>
            <input
              type="checkbox"
              checked={state.leadCapture}
              onChange={(event) => patch({ leadCapture: event.target.checked })}
            />
            Show the enquiry form (emails the listing agent)
          </span>
        </label>
      </section>

      <StickySaveBar
        dirty={current !== saved}
        busy={busy}
        label="Save page"
        onSave={() => void save()}
      />

      <ListingDomainEditor pageId={pageId} />
    </div>
  );
}
