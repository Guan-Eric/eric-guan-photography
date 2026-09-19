"use client";

import { useState } from "react";
import Link from "next/link";
import type { ListingSection, OpenHouse } from "@/lib/listing-content";
import {
  AGENCY_LICENSE_TYPES,
  BROKER_LICENSE_TYPES,
  COMPLIANCE_REGIONS,
  LISTING_STATUSES,
  type AgencyLicenseType,
  type BrokerLicenseType,
  type ComplianceRegion,
  type ListingStatus,
} from "@/lib/db/schema";
import {
  AGENCY_LICENSE_LABELS,
  BROKER_LICENSE_LABELS,
} from "@/lib/listing-compliance";
import { UnsavedChangesProvider, useUnsavedChanges } from "@/components/unsaved-changes";
import { toastError, toastSuccess } from "@/lib/toast";

type CopyState = {
  headline: string;
  description: string;
  sections: ListingSection[];
  openHouses: OpenHouse[];
  brokerage: string;
  brokeragePhone: string;
  agentPhone: string;
  complianceRegion: ComplianceRegion;
  licenseDisplayName: string;
  licenseType: BrokerLicenseType | "";
  agencyLegalName: string;
  agencyLicenseType: AgencyLicenseType | "";
  listingStatus: ListingStatus;
  advertisingEndsAt: string;
  deedSignedAt: boolean;
};

function fromDateInput(value: string) {
  if (!value.trim()) return null;
  return new Date(`${value}T23:59:59.000Z`).toISOString();
}

function toDateInput(iso: string | null | undefined) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

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

  async function save(extra?: { renew?: boolean }) {
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
          brokerage: state.brokerage,
          brokeragePhone: state.brokeragePhone,
          agentPhone: state.agentPhone,
          complianceRegion: state.complianceRegion,
          licenseDisplayName: state.licenseDisplayName || null,
          licenseType: state.licenseType || null,
          agencyLegalName: state.agencyLegalName || null,
          agencyLicenseType: state.agencyLicenseType || null,
          listingStatus: state.listingStatus,
          advertisingEndsAt: fromDateInput(state.advertisingEndsAt),
          deedSignedAt: state.deedSignedAt ? new Date().toISOString() : null,
          renew: extra?.renew ?? false,
          published: true,
        }),
      });
      const json = await response.json().catch(() => null);
      if (!json?.ok) {
        const message =
          json?.checklistErrors?.join(" ") ??
          json?.error ??
          "Could not save listing copy.";
        setError(message);
        toastError(message);
        return;
      }
      setNotice(extra?.renew ? "Advertising window renewed." : "Saved.");
      toastSuccess(extra?.renew ? "Listing renewed." : "Listing copy saved.");
      if (json.page?.advertisingEndsAt) {
        patch({ advertisingEndsAt: toDateInput(json.page.advertisingEndsAt) });
      }
      setSaved(current);
    } catch {
      setError("Network error.");
      toastError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  const isQc = state.complianceRegion === "ca_qc";

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
          onClick={() => save()}
        >
          {busy ? "Saving…" : "Save copy"}
        </button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="form-success">{notice}</p> : null}

      <p className="field-hint">
        Brokerage name and phone are required before the property website can go
        live. Photos and page look are set by the photographer.
      </p>

      <section className="studio-section">
        <h2>Broker identity and status</h2>
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
                  ? "Quebec (OACIQ)"
                  : region === "us_ca"
                    ? "California"
                    : "Canada (other)"}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Brokerage / agency</span>
          <input
            value={state.brokerage}
            onChange={(event) => patch({ brokerage: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Brokerage phone</span>
          <input
            value={state.brokeragePhone}
            onChange={(event) => patch({ brokeragePhone: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Your phone</span>
          <input
            value={state.agentPhone}
            onChange={(event) => patch({ agentPhone: event.target.value })}
          />
        </label>
        {isQc ? (
          <>
            <label className="field">
              <span>Name as on OACIQ licence</span>
              <input
                value={state.licenseDisplayName}
                onChange={(event) =>
                  patch({ licenseDisplayName: event.target.value })
                }
              />
            </label>
            <label className="field">
              <span>Licence type</span>
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
                    {BROKER_LICENSE_LABELS[type].fr}
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
                    {AGENCY_LICENSE_LABELS[type].fr}
                  </option>
                ))}
              </select>
            </label>
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
          <span>Brokerage contract end</span>
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
            Deed signed — take page offline
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
            rows={6}
            value={state.description}
            onChange={(event) => patch({ description: event.target.value })}
          />
        </label>
      </section>

      <section className="studio-section">
        <h2>Extra sections</h2>
        {state.sections.map((section, index) => (
          <div key={index} className="listing-section-row">
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
              Remove
            </button>
          </div>
        ))}
        {state.sections.length < 8 ? (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() =>
              patch({
                sections: [...state.sections, { heading: "", body: "" }],
              })
            }
          >
            Add section
          </button>
        ) : null}
      </section>

      <section className="studio-section">
        <h2>Open houses</h2>
        {state.openHouses.map((entry, index) => (
          <div key={index} className="listing-section-row">
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
        <button
          type="button"
          className={`btn btn-solid${busy ? " is-busy" : ""}`}
          disabled={busy}
          onClick={() => save()}
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
