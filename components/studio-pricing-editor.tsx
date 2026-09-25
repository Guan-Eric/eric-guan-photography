"use client";

import { useState } from "react";
import { StickySaveBar } from "@/components/sticky-save-bar";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import { normalizeStudioCurrency } from "@/lib/currency";
import { MAX_SERVICE_CATEGORIES } from "@/lib/service-categories";
import {
  DEFAULT_PRICING_LEDE,
  PRICING_LEDE_MAX_LENGTH,
} from "@/lib/studio-defaults";
import { toastError, toastSuccess } from "@/lib/toast";
import type { Package, PriceBand, ServiceCategory, Tenant } from "@/lib/tenant-schema";

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
  const [categories, setCategories] = useState<ServiceCategory[]>(
    tenant.serviceCategories ?? [],
  );
  const [pricingLede, setPricingLede] = useState(
    tenant.pricingLede?.trim() || DEFAULT_PRICING_LEDE,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const current = JSON.stringify({ packages, categories, pricingLede });
  const [saved, setSaved] = useState(current);
  useUnsavedChanges(current !== saved);

  const shootPackages = packages.filter((pkg) => !pkg.upsell);

  function categoryLabel(pkg: Package) {
    if (pkg.upsell) return "Add-on";
    const category = categories.find((row) => row.id === pkg.categoryId);
    return category?.name.trim() || "Uncategorized";
  }

  function expandAndScroll(id: string) {
    setExpandedId(id);
    window.setTimeout(() => {
      document
        .getElementById(`pricing-item-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  }

  function addPackage() {
    const pkg = emptyPackage();
    setPackages((list) => [...list, pkg]);
    expandAndScroll(pkg.id);
  }

  function addAddon() {
    const pkg = emptyAddon();
    setPackages((list) => [...list, pkg]);
    expandAndScroll(pkg.id);
  }

  function addCategory() {
    setCategories((list) => [
      ...list,
      { id: `cat_${Math.random().toString(36).slice(2, 10)}`, name: "" },
    ]);
  }

  function updateCategory(index: number, patch: Partial<ServiceCategory>) {
    setCategories((list) =>
      list.map((category, i) => (i === index ? { ...category, ...patch } : category)),
    );
  }

  function moveCategory(index: number, delta: -1 | 1) {
    setCategories((list) => {
      const target = index + delta;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  function removeCategory(index: number) {
    const category = categories[index];
    if (!category) return;
    const count = packages.filter((pkg) => pkg.categoryId === category.id).length;
    const label = category.name.trim() || "this category";
    const suffix = count > 0 ? ` ${count} service${count === 1 ? "" : "s"} will become uncategorized.` : "";
    if (!window.confirm(`Remove “${label}”?${suffix}`)) return;
    setCategories((list) => list.filter((_, i) => i !== index));
    setPackages((list) =>
      list.map((pkg) =>
        pkg.categoryId === category.id ? { ...pkg, categoryId: undefined } : pkg,
      ),
    );
  }

  function update(index: number, patch: Partial<Package>) {
    setPackages((current) =>
      current.map((pkg, i) => (i === index ? { ...pkg, ...patch } : pkg)),
    );
  }

  /** Nearest index in `delta` direction with the same kind (package vs add-on). */
  function neighborOfSameKind(list: Package[], index: number, delta: -1 | 1) {
    const isAddon = Boolean(list[index]?.upsell);
    for (let i = index + delta; i >= 0 && i < list.length; i += delta) {
      if (Boolean(list[i]!.upsell) === isAddon) return i;
    }
    return -1;
  }

  function movePackage(index: number, delta: -1 | 1) {
    setPackages((list) => {
      const target = neighborOfSameKind(list, index, delta);
      if (target < 0) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  function removePackage(index: number) {
    const pkg = packages[index];
    if (!pkg) return;
    const label = pkg.name.trim() || (pkg.upsell ? "this add-on" : "this package");
    if (!window.confirm(`Remove “${label}”?`)) return;
    setPackages((current) => current.filter((_, i) => i !== index));
    setExpandedId((current) => (current === pkg.id ? null : current));
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
        body: JSON.stringify({
          section: "pricing",
          packages,
          serviceCategories: categories,
          pricingLede,
        }),
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
    <form
      id="studio-pricing-form"
      className="studio-settings studio-settings--wide"
      onSubmit={onSave}
    >
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
        <div className="admin-toolbar-actions">
          <button type="button" className="btn btn-outline" onClick={addPackage}>
            Add package
          </button>
          <button type="button" className="btn btn-outline" onClick={addAddon}>
            Add add-on
          </button>
          <a className="btn btn-outline" href={viewUrl} target="_blank" rel="noreferrer">
            View on site
          </a>
        </div>
      </div>

      <section className="studio-section">
        <h2>Pricing page intro</h2>
        <p className="studio-section-lede">
          Shown under the headline on your public pricing page. Use{" "}
          <code>{"{turnaround}"}</code> to insert the delivery promise from{" "}
          <a href="/admin/booking">Booking</a>.
        </p>
        <label className="field">
          <span className="sr-only">Pricing page intro</span>
          <textarea
            rows={3}
            value={pricingLede}
            maxLength={PRICING_LEDE_MAX_LENGTH}
            onChange={(event) => setPricingLede(event.target.value)}
            required
          />
        </label>
      </section>

      <section className="studio-section">
        <div className="studio-editor-row">
          <h2>Categories</h2>
          <button
            type="button"
            className="btn btn-outline"
            onClick={addCategory}
            disabled={categories.length >= MAX_SERVICE_CATEGORIES}
          >
            Add category
          </button>
        </div>
        <p className="studio-section-lede">
          Group services into sections like Packages, Photography, Video, or Floor
          Plans. Agents see them in this order on your booking and pricing pages.
        </p>
        {categories.length === 0 ? (
          <p className="studio-empty-inline">
            No categories yet — every service shows in one list.
          </p>
        ) : (
          <ol className="studio-category-list">
            {categories.map((category, index) => {
              const count = packages.filter((pkg) => pkg.categoryId === category.id).length;
              return (
                <li key={category.id} className="studio-category-row">
                  <div className="form-grid">
                    <label className="field">
                      <span>Name</span>
                      <input
                        value={category.name}
                        onChange={(event) => updateCategory(index, { name: event.target.value })}
                        placeholder="Photography"
                        maxLength={60}
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Description (optional)</span>
                      <input
                        value={category.description ?? ""}
                        onChange={(event) =>
                          updateCategory(index, { description: event.target.value })
                        }
                        placeholder="HDR interiors and exteriors"
                        maxLength={200}
                      />
                    </label>
                  </div>
                  <div className="studio-category-actions">
                    <span className="muted">
                      {count} service{count === 1 ? "" : "s"}
                    </span>
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => moveCategory(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${category.name || "category"} up`}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => moveCategory(index, 1)}
                      disabled={index === categories.length - 1}
                      aria-label={`Move ${category.name || "category"} down`}
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => removeCategory(index)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {[
        { heading: "Packages", upsell: false, empty: "No packages yet." },
        { heading: "Add-ons", upsell: true, empty: "No add-ons yet." },
      ].map((group) => (
      <div key={group.heading} className="studio-editor-list">
        <h2 className="studio-editor-group-heading">{group.heading}</h2>
        {packages.every((pkg) => Boolean(pkg.upsell) !== group.upsell) ? (
          <p className="studio-empty-inline">{group.empty}</p>
        ) : null}
        {packages.map((pkg, index) => {
          if (Boolean(pkg.upsell) !== group.upsell) return null;
          const isAddon = Boolean(pkg.upsell);
          const mode = modeOf(pkg);
          const expanded = expandedId === pkg.id;
          const title = pkg.name || (isAddon ? "New add-on" : "New package");
          return (
            <section
              key={pkg.id}
              id={`pricing-item-${pkg.id}`}
              className="studio-section studio-editor-item studio-collapse-item"
            >
              <div className="studio-collapse-summary">
                <button
                  type="button"
                  className="studio-collapse-summary-main"
                  aria-expanded={expanded}
                  onClick={() => setExpandedId(expanded ? null : pkg.id)}
                >
                  <strong>{title}</strong>
                  <span className="muted">
                    {pkg.price || "No price"} · {categoryLabel(pkg)}
                  </span>
                </button>
                <div className="studio-category-actions">
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setExpandedId(expanded ? null : pkg.id)}
                  >
                    {expanded ? "Collapse" : "Edit"}
                  </button>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => movePackage(index, -1)}
                    disabled={neighborOfSameKind(packages, index, -1) < 0}
                    aria-label={`Move ${title} up`}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => movePackage(index, 1)}
                    disabled={neighborOfSameKind(packages, index, 1) < 0}
                    aria-label={`Move ${title} down`}
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => removePackage(index)}
                  >
                    Remove
                  </button>
                </div>
              </div>

              {expanded ? (
              <div className="studio-collapse-body">

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
                  {categories.length > 0 ? (
                    <label className="field">
                      <span>Category</span>
                      <select
                        value={pkg.categoryId ?? ""}
                        onChange={(event) =>
                          update(index, { categoryId: event.target.value || undefined })
                        }
                      >
                        <option value="">Uncategorized (Other services)</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name || "Untitled category"}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
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
                                categoryId: undefined,
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
              </div>
              ) : null}
            </section>
          );
        })}
      </div>
      ))}

      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      <StickySaveBar
        dirty={current !== saved}
        busy={busy}
        label="Save pricing"
        formId="studio-pricing-form"
      />
    </form>
  );
}
