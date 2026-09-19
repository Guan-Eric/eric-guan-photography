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
  publicUrl,
  initial,
  propertyAddress,
}: {
  pageId: string;
  publicUrl: string;
  initial: EditorState;
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

  function patchPhoto(id: string, next: Partial<PhotoState>) {
    setState((current) => ({
      ...current,
      photos: current.photos.map((photo) =>
        photo.id === id ? { ...photo, ...next } : photo,
      ),
      captions:
        next.caption !== undefined
          ? { ...current.captions, [id]: next.caption }
          : current.captions,
    }));
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
        <button type="button" className={`btn btn-solid${busy ? " is-busy" : ""}`} disabled={busy} onClick={() => save()}>
          {busy ? "Saving…" : "Save page"}
        </button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="form-success">{notice}</p> : null}

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
          Tag virtually staged / AI / digitally altered images. For California,
          link each altered photo to its unaltered counterpart and mark that
          counterpart public.
        </p>
        {state.photos.length === 0 ? (
          <p className="field-hint">Upload photos on the order first.</p>
        ) : (
          <div className="hero-pick">
            {state.photos.map((photo) => {
              const selected = hero === photo.id;
              return (
                <div key={photo.id} className="hero-pick-item">
                  <button
                    type="button"
                    className={selected ? "is-current" : undefined}
                    aria-pressed={selected}
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
                      value={photo.caption}
                      maxLength={80}
                      placeholder="Caption (optional)"
                      onChange={(event) =>
                        patchPhoto(photo.id, { caption: event.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Enhancement</span>
                    <select
                      value={photo.enhancementTag ?? ""}
                      onChange={(event) =>
                        patchPhoto(photo.id, {
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
                  {photo.enhancementTag ? (
                    <label className="field">
                      <span>Unaltered counterpart</span>
                      <select
                        value={photo.originalDisclosureAssetId}
                        onChange={(event) =>
                          patchPhoto(photo.id, {
                            originalDisclosureAssetId: event.target.value,
                          })
                        }
                      >
                        <option value="">Select…</option>
                        {state.photos
                          .filter((row) => row.id !== photo.id)
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
                        checked={photo.disclosurePublic}
                        onChange={(event) =>
                          patchPhoto(photo.id, {
                            disclosurePublic: event.target.checked,
                          })
                        }
                      />
                      Public unaltered original
                    </span>
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
        <button type="button" className={`btn btn-solid${busy ? " is-busy" : ""}`} disabled={busy} onClick={() => save()}>
          {busy ? "Saving…" : "Save page"}
        </button>
      </section>

      <ListingDomainEditor pageId={pageId} />
    </div>
  );
}
