"use client";

import { useState } from "react";
import { normalizeStudioCurrency } from "@/lib/currency";
import { toastError, toastSuccess } from "@/lib/toast";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import type { Package, PriceBand, Tenant } from "@/lib/tenant-schema";

type PricingMode = "set_price" | "quote_later" | "email_only";

function dollars(cents: number | undefined) {
  if (cents == null) return "";
  return String(cents / 100);
}

function toCents(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100);
}

function modeOf(pkg: Package): PricingMode {
  if (pkg.durationMinutes == null) return "email_only";
  if (pkg.quoteLater) return "quote_later";
  return "set_price";
}

function emptyPackage(): Package {
  return {
    id: `pkg_${Math.random().toString(36).slice(2, 10)}`,
    name: "",
    summary: "",
    price: "",
    durationMinutes: 60,
    includes: [],
    priceCents: 20000,
    priceBands: [],
  };
}

function emptyAddon(): Package {
  return {
    id: `addon_${Math.random().toString(36).slice(2, 10)}`,
    name: "",
    summary: "",
    price: "$75",
    durationMinutes: null,
    includes: [],
    upsell: true,
    priceCents: 7500,
    applicablePackageIds: [],
  };
}

export function StudioPricingEditor({
  tenant,
  viewUrl,
}: {
  tenant: Tenant;
  viewUrl: string;
}) {
  const currency = normalizeStudioCurrency(tenant.seo.currency);
  const [packages, setPackages] = useState<Package[]>(tenant.packages);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const current = JSON.stringify(packages);
  const [saved, setSaved] = useState(current);
  useUnsavedChanges(current !== saved);

  const shootPackages = packages.filter((pkg) => !pkg.upsell);

  function update(index: number, patch: Partial<Package>) {
    setPackages((current) =>
      current.map((pkg, i) => (i === index ? { ...pkg, ...patch } : pkg)),
    );
  }

  function removePackage(index: number) {
    const pkg = packages[index];
    if (!pkg) return;
    const label = pkg.name.trim() || (pkg.upsell ? "this add-on" : "this package");
    if (!window.confirm(`Remove “${label}”?`)) return;
    setPackages((current) => current.filter((_, i) => i !== index));
  }

  function setMode(index: number, mode: PricingMode) {
    setPackages((current) =>
      current.map((pkg, i) => {
        if (i !== index) return pkg;
        if (mode === "email_only") {
          return {
            ...pkg,
            durationMinutes: null,
            quoteLater: undefined,
            price: pkg.price || "Custom",
          };
        }
        if (mode === "quote_later") {
          return {
            ...pkg,
            durationMinutes: pkg.durationMinutes ?? 60,
            quoteLater: true,
            price: "Quote after request",
            priceCents: undefined,
            priceBands: [],
          };
        }
        return {
          ...pkg,
          durationMinutes: pkg.durationMinutes ?? 60,
          quoteLater: undefined,
          priceCents: pkg.priceCents ?? 20000,
          price: pkg.price === "Quote after request" ? "" : pkg.price,
        };
      }),
    );
  }

  function updateBand(pkgIndex: number, bandIndex: number, patch: Partial<PriceBand>) {
    setPackages((current) =>
      current.map((pkg, i) => {
        if (i !== pkgIndex) return pkg;
        const bands = [...(pkg.priceBands ?? [])];
        bands[bandIndex] = { ...bands[bandIndex]!, ...patch };
        return { ...pkg, priceBands: bands };
      }),
    );
  }

  function removeBand(pkgIndex: number, bandIndex: number) {
    setPackages((current) =>
      current.map((pkg, i) => {
        if (i !== pkgIndex) return pkg;
        const bands = [...(pkg.priceBands ?? [])];
        bands.splice(bandIndex, 1);
        return { ...pkg, priceBands: bands };
      }),
    );
  }

  function toggleApplicable(index: number, packageId: string, checked: boolean) {
    const pkg = packages[index];
    if (!pkg) return;
    const currentIds = pkg.applicablePackageIds ?? [];
    const next = checked
      ? [...new Set([...currentIds, packageId])]
      : currentIds.filter((id) => id !== packageId);
    update(index, { applicablePackageIds: next });
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
        body: JSON.stringify({ section: "pricing", packages }),
      });
      const json = await response.json();
      if (!json.ok) {
        setError(json.error ?? "Could not save.");
        toastError(json.error ?? "Could not save.");
        return;
      }
      setMessage("Pricing saved.");
      toastSuccess("Pricing saved.");
      setSaved(current);
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
          <p className="eyebrow">Pricing</p>
          <h1>Packages</h1>
          <p className="muted">
            Set a firm price for online booking, or quote after the agent requests.
            Amounts are in <strong>{currency}</strong>. Change currency under{" "}
            <a href="/admin/booking">Booking</a>.
          </p>
        </div>
        <a className="btn btn-outline" href={viewUrl} target="_blank" rel="noreferrer">
          View on site
        </a>
      </div>

      <div className="studio-editor-list">
        {packages.map((pkg, index) => {
          const isAddon = Boolean(pkg.upsell);
          const mode = modeOf(pkg);
          return (
            <section key={pkg.id} className="studio-section studio-editor-item">
              <div className="studio-editor-row">
                <h2>
                  {pkg.name || (isAddon ? "New add-on" : "New package")}
                  {isAddon ? (
                    <span className="muted" style={{ marginLeft: "0.5rem", fontSize: "0.85rem" }}>
                      Add-on
                    </span>
                  ) : null}
                </h2>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => removePackage(index)}
                >
                  Remove
                </button>
              </div>

              {isAddon ? (
                <>
                  <div className="form-grid">
                    <label className="field">
                      <span>Name</span>
                      <input
                        value={pkg.name}
                        onChange={(event) => update(index, { name: event.target.value })}
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Price ({currency})</span>
                      <input
                        type="number"
                        min={0}
                        step="1"
                        value={dollars(pkg.priceCents)}
                        onChange={(event) => {
                          const cents = toCents(event.target.value);
                          update(index, {
                            priceCents: cents,
                            price:
                              cents != null
                                ? new Intl.NumberFormat("en-CA", {
                                    style: "currency",
                                    currency,
                                    maximumFractionDigits: 0,
                                  }).format(cents / 100)
                                : pkg.price,
                          });
                        }}
                        required
                      />
                    </label>
                  </div>
                  <label className="field">
                    <span>Summary</span>
                    <input
                      value={pkg.summary}
                      onChange={(event) => update(index, { summary: event.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Display price</span>
                    <input
                      value={pkg.price}
                      onChange={(event) => update(index, { price: event.target.value })}
                      placeholder="$75"
                    />
                  </label>
                  <fieldset className="field">
                    <legend>Applies to packages</legend>
                    <p className="field-hint">
                      Leave all unchecked to offer this add-on with every shoot package.
                    </p>
                    {shootPackages.length === 0 ? (
                      <p className="field-hint">Add a shoot package first.</p>
                    ) : (
                      <div className="studio-addon-applies">
                        {shootPackages.map((shoot) => {
                          const ids = pkg.applicablePackageIds ?? [];
                          const checked = ids.includes(shoot.id);
                          return (
                            <label key={shoot.id} className="field field-check">
                              <span>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(event) =>
                                    toggleApplicable(index, shoot.id, event.target.checked)
                                  }
                                />{" "}
                                {shoot.name || shoot.id}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </fieldset>
                  <label className="field">
                    <span>Includes (one per line)</span>
                    <textarea
                      rows={3}
                      value={pkg.includes.join("\n")}
                      onChange={(event) =>
                        update(index, {
                          includes: event.target.value
                            .split("\n")
                            .map((line) => line.trim()),
                        })
                      }
                    />
                  </label>
                </>
              ) : (
                <>
                  <div className="form-grid">
                    <label className="field">
                      <span>Name</span>
                      <input
                        value={pkg.name}
                        onChange={(event) => update(index, { name: event.target.value })}
                        required
                      />
                    </label>
                    <label className="field">
                      <span>How pricing works</span>
                      <select
                        value={mode}
                        onChange={(event) =>
                          setMode(index, event.target.value as PricingMode)
                        }
                      >
                        <option value="set_price">Set price now (agents see quote)</option>
                        <option value="quote_later">
                          Decide price after request
                        </option>
                        <option value="email_only">Email only (not bookable online)</option>
                      </select>
                    </label>
                  </div>
                  <label className="field">
                    <span>Summary</span>
                    <input
                      value={pkg.summary}
                      onChange={(event) => update(index, { summary: event.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Display price on pricing page</span>
                    <input
                      value={pkg.price}
                      onChange={(event) => update(index, { price: event.target.value })}
                      placeholder={
                        mode === "quote_later"
                          ? "Quote after request"
                          : mode === "email_only"
                            ? "Custom"
                            : "$150–$250"
                      }
                    />
                  </label>

                  {mode !== "email_only" ? (
                    <label className="field">
                      <span>On-site minutes</span>
                      <input
                        type="number"
                        min={15}
                        value={pkg.durationMinutes ?? ""}
                        onChange={(event) =>
                          update(index, {
                            durationMinutes: event.target.value
                              ? Number(event.target.value)
                              : 60,
                          })
                        }
                        required
                      />
                    </label>
                  ) : (
                    <p className="field-hint">
                      Agents email you to book. No online quote or calendar hold.
                    </p>
                  )}

                  {mode === "quote_later" ? (
                    <p className="field-hint">
                      Agents can request a shoot online. You set the final price on the
                      Orders board after reviewing the property.
                    </p>
                  ) : null}

                  {mode === "set_price" ? (
                    <>
                      <label className="field">
                        <span>Base quote price ({currency})</span>
                        <input
                          type="number"
                          min={0}
                          step="1"
                          value={dollars(pkg.priceCents)}
                          onChange={(event) =>
                            update(index, { priceCents: toCents(event.target.value) })
                          }
                        />
                      </label>
                      <p className="field-hint">
                        Optional sq ft bands override the base price. Leave empty to use
                        one price for every size.
                      </p>
                      {(pkg.priceBands ?? []).map((band, bandIndex) => (
                        <div key={bandIndex} className="studio-price-band">
                          <div className="studio-editor-row">
                            <span className="muted">Band {bandIndex + 1}</span>
                            <button
                              type="button"
                              className="text-link"
                              onClick={() => removeBand(index, bandIndex)}
                            >
                              Remove
                            </button>
                          </div>
                          <div className="form-grid">
                            <label className="field">
                              <span>Up to sq ft</span>
                              <input
                                type="number"
                                min={1}
                                value={band.maxSqft}
                                onChange={(event) =>
                                  updateBand(index, bandIndex, {
                                    maxSqft: Number(event.target.value),
                                  })
                                }
                              />
                            </label>
                            <label className="field">
                              <span>Price (dollars)</span>
                              <input
                                type="number"
                                min={0}
                                value={dollars(band.priceCents)}
                                onChange={(event) =>
                                  updateBand(index, bandIndex, {
                                    priceCents: toCents(event.target.value) ?? 0,
                                  })
                                }
                              />
                            </label>
                            <label className="field field-span">
                              <span>Label</span>
                              <input
                                value={band.label}
                                onChange={(event) =>
                                  updateBand(index, bandIndex, {
                                    label: event.target.value,
                                  })
                                }
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() =>
                          update(index, {
                            priceBands: [
                              ...(pkg.priceBands ?? []),
                              {
                                maxSqft: 2500,
                                priceCents: pkg.priceCents ?? 20000,
                                label: "",
                              },
                            ],
                          })
                        }
                      >
                        Add price band
                      </button>
                    </>
                  ) : null}

                  <label className="field">
                    <span>Includes (one per line)</span>
                    <textarea
                      rows={4}
                      value={pkg.includes.join("\n")}
                      onChange={(event) =>
                        update(index, {
                          includes: event.target.value
                            .split("\n")
                            .map((line) => line.trim()),
                        })
                      }
                    />
                  </label>
                  <div className="studio-editor-row">
                    <label className="field field-check">
                      <span>
                        <input
                          type="checkbox"
                          checked={Boolean(pkg.featured)}
                          onChange={(event) =>
                            update(index, { featured: event.target.checked })
                          }
                        />{" "}
                        Featured
                      </span>
                    </label>
                    <label className="field field-check">
                      <span>
                        <input
                          type="checkbox"
                          checked={Boolean(pkg.upsell)}
                          onChange={(event) => {
                            if (event.target.checked) {
                              update(index, {
                                upsell: true,
                                durationMinutes: null,
                                quoteLater: undefined,
                                priceBands: [],
                                priceCents: pkg.priceCents ?? 7500,
                                applicablePackageIds: pkg.applicablePackageIds ?? [],
                              });
                            } else {
                              update(index, {
                                upsell: false,
                                durationMinutes: pkg.durationMinutes ?? 60,
                                applicablePackageIds: undefined,
                              });
                            }
                          }}
                        />{" "}
                        Convert to add-on
                      </span>
                    </label>
                  </div>
                </>
              )}
            </section>
          );
        })}
      </div>

      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      <div className="listing-index-actions">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => setPackages((current) => [...current, emptyPackage()])}
        >
          Add package
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => setPackages((current) => [...current, emptyAddon()])}
        >
          Add add-on
        </button>
        <button className={`btn btn-solid${busy ? " is-busy" : ""}`} type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save pricing"}
        </button>
      </div>
    </form>
  );
}
